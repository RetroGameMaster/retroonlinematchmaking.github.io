import importlib.util
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


SCRIPT = Path(__file__).with_name("rom_sqlite_sync.py")
SPEC = importlib.util.spec_from_file_location("rom_sqlite_sync", SCRIPT)
SYNC = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(SYNC)


class ReadOnlyBridgeTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.database_path = Path(self.temp_dir.name) / "bot.db"
        self.connection = sqlite3.connect(self.database_path)
        self.connection.executescript(
            """
            CREATE TABLE Consoles (Id INTEGER PRIMARY KEY, Abbreviation TEXT);
            CREATE TABLE Games (Id INTEGER PRIMARY KEY, Title TEXT, ConsoleId INTEGER);
            CREATE TABLE GameAlternateNames (
              Id INTEGER PRIMARY KEY, GameId INTEGER, Name TEXT
            );
            CREATE TABLE LfgMessages (
              Id INTEGER PRIMARY KEY, GuildId INTEGER, ChannelId INTEGER,
              MessageId INTEGER, ExpireDateTime TEXT, MinimumPlayersNeeded INTEGER,
              RoleName TEXT, ConnectionMethods TEXT, DiscordTimestamp TEXT,
              AdditionalNotes TEXT, Expired INTEGER, GameId INTEGER
            );
            CREATE TABLE Users (Id INTEGER PRIMARY KEY, UserId INTEGER, LfgMessageId INTEGER);
            CREATE TABLE ActiveGames (
              Id INTEGER PRIMARY KEY, GameId INTEGER, PlayersOnline INTEGER,
              ConnectionTypeId INTEGER
            );
            CREATE TABLE ActiveGameRecords (
              Id INTEGER PRIMARY KEY, ActiveGameId INTEGER, GuildId INTEGER,
              FullGameName TEXT, MessageId INTEGER, ThreadId INTEGER
            );
            CREATE TABLE ConnectionTypes (
              Id INTEGER PRIMARY KEY, RoleId INTEGER, GuildId INTEGER,
              RoleName TEXT, Description TEXT
            );
            CREATE TABLE Wins (Id INTEGER PRIMARY KEY);
            CREATE TABLE TeamWins (Id INTEGER PRIMARY KEY);

            INSERT INTO Consoles VALUES (1, 'PS2');
            INSERT INTO Games VALUES (10, 'Example Game', 1);
            INSERT INTO GameAlternateNames VALUES (1, 10, 'Example Alias');
            INSERT INTO LfgMessages VALUES (
              20, 12345678901234567, 22345678901234567, 32345678901234567,
              '2099-01-01T00:00:00Z', 4, 'Players', 'Netplay',
              'today', 'Public note', 0, 10
            );
            INSERT INTO Users VALUES (1, 42345678901234567, 20);
            INSERT INTO Users VALUES (2, 52345678901234567, 20);
            INSERT INTO ConnectionTypes VALUES (30, 1, 12345678901234567, 'Netplay', '');
            INSERT INTO ActiveGames VALUES (40, 10, 3, 30);
            INSERT INTO ActiveGameRecords VALUES (
              50, 40, 12345678901234567, NULL, 0, 62345678901234567
            );
            INSERT INTO Wins VALUES (1);
            INSERT INTO Wins VALUES (2);
            INSERT INTO TeamWins VALUES (1);
            """
        )
        self.connection.commit()
        self.connection.close()

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_database_connection_is_read_only(self):
        with SYNC.open_database(self.database_path) as connection:
            with self.assertRaises(sqlite3.OperationalError):
                connection.execute("DELETE FROM Games")

    def test_catalog_includes_alternate_names(self):
        with SYNC.open_database(self.database_path) as connection:
            games = SYNC.read_catalog(connection)
        self.assertEqual(
            games,
            [{
                "source_game_id": 10,
                "title": "Example Game",
                "console": "PS2",
                "alternate_names": ["Example Alias"],
            }],
        )

    def test_invites_publish_counts_without_user_ids(self):
        with SYNC.open_database(self.database_path) as connection:
            invites = SYNC.read_invites(connection)
        invite = invites["12345678901234567"][0]
        self.assertEqual(invite["player_count"], 2)
        self.assertEqual(invite["minimum_players"], 4)
        self.assertNotIn("user_id", invite)
        self.assertNotIn("host_discord_id", invite)

    def test_active_games_and_aggregate_stats(self):
        with SYNC.open_database(self.database_path) as connection:
            services = SYNC.read_services(connection)
            invites = SYNC.read_invites(connection)
            games = SYNC.read_catalog(connection)
            stats = SYNC.read_public_stats(connection, len(games), invites, services)
        self.assertEqual(services["12345678901234567"][0]["players_online"], 3)
        self.assertEqual(stats["game_count"], 1)
        self.assertEqual(stats["total_wins"], 2)
        self.assertEqual(stats["team_wins"], 1)
        self.assertEqual(stats["active_invite_count"], 1)

    def test_supabase_request_includes_gateway_headers(self):
        class Response:
            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def read(self):
                return b'{"ok": true}'

        with patch.object(SYNC, "urlopen", return_value=Response()) as open_url:
            result = SYNC.post_action(
                "https://example.supabase.co/functions/v1/bridge",
                "bridge-secret",
                "public-anon-key",
                {"action": "sync_stats"},
            )
        request = open_url.call_args.args[0]
        self.assertEqual(request.get_header("Apikey"), "public-anon-key")
        self.assertEqual(request.get_header("Authorization"), "Bearer public-anon-key")
        self.assertEqual(request.get_header("X-rom-bridge-secret"), "bridge-secret")
        self.assertTrue(result["ok"])


if __name__ == "__main__":
    unittest.main()
