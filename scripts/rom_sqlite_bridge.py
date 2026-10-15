#!/usr/bin/env python3
"""Read-only ROM SQLite bridge: sync active lobbies and live API/service counts to Supabase.

This is a separate process. It never writes to localdb.db and never modifies the bot.
Environment variables:
  ROM_SQLITE_PATH
  ROM_SUPABASE_FUNCTION_URL
  ROM_BRIDGE_SECRET
  ROM_DISCORD_GUILD_ID
"""
import argparse
import datetime as dt
import json
import os
import sqlite3
import sys
import time
import urllib.error
import urllib.request

def parse_time(value):
    if not value:
        return None
    try:
        parsed = dt.datetime.fromisoformat(str(value).strip().replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=dt.timezone.utc)
        return parsed.astimezone(dt.timezone.utc)
    except ValueError:
        return None

def snowflake(value):
    return str(value) if value is not None and str(value).isdigit() and len(str(value)) >= 15 else None

def read_only(db_path):
    return sqlite3.connect(f"file:{os.path.abspath(db_path)}?mode=ro", uri=True, timeout=10)

def get_lobbies(db_path, guild_id):
    conn = read_only(db_path)
    conn.row_factory = sqlite3.Row
    try:
        now = dt.datetime.now(dt.timezone.utc)
        rows = conn.execute("""
          SELECT l.GuildId,l.ChannelId,l.MessageId,l.UserId,l.ExpireDateTime,
                 l.MinimumPlayersNeeded,l.RoleName,l.ConnectionMethods,l.AdditionalNotes,
                 l.Expired,l.GameId,g.Title AS GameTitle,c.Abbreviation AS ConsoleName
          FROM LfgMessages l
          LEFT JOIN Games g ON g.Id=l.GameId
          LEFT JOIN Consoles c ON c.Id=g.ConsoleId
          WHERE l.GuildId=? AND l.Expired=0 ORDER BY l.Id DESC
        """, (int(guild_id),)).fetchall()
        result, seen = [], set()
        for r in rows:
            expiry = parse_time(r["ExpireDateTime"])
            ids = [snowflake(r[k]) for k in ("GuildId","ChannelId","MessageId","UserId")]
            if not expiry or expiry <= now or not all(ids) or ids[2] in seen:
                continue
            seen.add(ids[2])
            result.append({
              "guild_id":ids[0],"channel_id":ids[1],"message_id":ids[2],"host_discord_id":ids[3],
              "game_id":int(r["GameId"]) if r["GameId"] is not None else None,
              "game_title":str(r["GameTitle"] or r["RoleName"] or "Unknown game")[:200],
              "console":str(r["ConsoleName"] or "")[:80] or None,
              "minimum_players":max(1,min(100,int(r["MinimumPlayersNeeded"] or 2))),
              "joined_players":0,"connection_methods":str(r["ConnectionMethods"] or "")[:1000],
              "additional_notes":str(r["AdditionalNotes"] or "")[:1000],
              "expires_at":expiry.isoformat().replace("+00:00","Z")
            })
            if len(result)>=500: break
        return result
    finally:
        conn.close()

def get_services(db_path, guild_id):
    conn = read_only(db_path)
    conn.row_factory = sqlite3.Row
    try:
        result = []
        rows = conn.execute("""
          SELECT a.Id,a.PlayersOnline,ct.GuildId,ct.RoleName AS ServiceName,
                 g.Title AS GameTitle,c.Abbreviation AS ConsoleName
          FROM ActiveGames a JOIN Games g ON g.Id=a.GameId
          JOIN Consoles c ON c.Id=g.ConsoleId
          JOIN ConnectionTypes ct ON ct.Id=a.ConnectionTypeId
          WHERE ct.GuildId=? AND a.PlayersOnline>0 ORDER BY a.PlayersOnline DESC
        """, (int(guild_id),)).fetchall()
        for r in rows:
            result.append({"source_key":f"activegame:{r['Id']}","guild_id":str(r["GuildId"]),
              "service_name":str(r["ServiceName"] or "Game service")[:100],
              "game_title":str(r["GameTitle"] or "Unknown game")[:200],
              "console":str(r["ConsoleName"] or "")[:80] or None,
              "players_online":max(0,int(r["PlayersOnline"] or 0)),"discord_url":None})
        dedicated = [
          ("ActiveOpenSpyGameRecords","ActiveGameName","Console","TotalActivePlayers","OpenSpy"),
          ("ActiveRewiredGameRecords","ActiveGameName",None,"TotalActivePlayers","PSRewired"),
          ("ActiveSocomCCGameRecords","ActiveGameName",None,"TotalActivePlayers","SOCOM.cc")
        ]
        for table,title_col,console_col,count_col,service in dedicated:
            query = f'SELECT Id,GuildId,"{title_col}" AS GameTitle,' + (f'"{console_col}" AS ConsoleName,' if console_col else 'NULL AS ConsoleName,') + f'"{count_col}" AS PlayersOnline FROM "{table}" WHERE GuildId=? AND "{count_col}">0'
            for r in conn.execute(query,(int(guild_id),)).fetchall():
                if r["GameTitle"]:
                    result.append({"source_key":f"{table.lower()}:{r['Id']}","guild_id":str(r["GuildId"]),
                      "service_name":service,"game_title":str(r["GameTitle"])[:200],
                      "console":str(r["ConsoleName"] or "")[:80] or None,
                      "players_online":max(0,int(r["PlayersOnline"] or 0)),"discord_url":None})
        result.sort(key=lambda x:x["players_online"],reverse=True)
        return result[:500]
    finally:
        conn.close()

def post(url, secret, payload):
    req=urllib.request.Request(url,data=json.dumps(payload).encode(),method="POST",
      headers={"Content-Type":"application/json","x-rom-bridge-secret":secret})
    try:
        with urllib.request.urlopen(req,timeout=25) as response:
            body=response.read().decode("utf-8")
            if not 200 <= response.status < 300: raise RuntimeError(f"HTTP {response.status}: {body}")
            return json.loads(body)
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"HTTP {exc.code}: {exc.read().decode('utf-8',errors='replace')}") from exc

def main():
    parser=argparse.ArgumentParser(description="Read-only ROM SQLite to Supabase bridge")
    parser.add_argument("--watch",action="store_true",help="repeat the sync")
    parser.add_argument("--interval",type=int,default=60,help="poll interval seconds (minimum 15)")
    args=parser.parse_args()
    db=os.environ.get("ROM_SQLITE_PATH","localdb.db")
    url=os.environ.get("ROM_SUPABASE_FUNCTION_URL","").strip()
    secret=os.environ.get("ROM_BRIDGE_SECRET","")
    guild=os.environ.get("ROM_DISCORD_GUILD_ID","").strip()
    missing=[n for n,v in [("ROM_SUPABASE_FUNCTION_URL",url),("ROM_BRIDGE_SECRET",secret),("ROM_DISCORD_GUILD_ID",guild)] if not v]
    if missing: parser.error("Missing environment variables: "+", ".join(missing))
    if not os.path.isfile(db): parser.error("SQLite file not found: "+db)
    while True:
        try:
            lobbies=get_lobbies(db,guild)
            lobby_result=post(url,secret,{"action":"sync","guild_id":str(guild),"lobbies":lobbies})
            services=get_services(db,guild)
            service_result=post(url,secret,{"action":"sync_services","guild_id":str(guild),"services":services})
            print(f"{dt.datetime.now(dt.timezone.utc).isoformat()} | {len(lobbies)} active LFG searches | {len(services)} live service records | {lobby_result} | {service_result}",flush=True)
        except Exception as exc:
            print(f"Sync failed: {exc}",file=sys.stderr,flush=True)
        if not args.watch: break
        time.sleep(max(15,args.interval))

if __name__=="__main__":
    main()
