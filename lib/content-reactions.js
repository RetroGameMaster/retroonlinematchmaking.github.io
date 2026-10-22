export async function mountContentReactions(container, supabase, targetType, targetId, userId) {
  return mountContentReactionBatch([{ container, targetId }], supabase, targetType, userId);
}

export async function mountContentReactionBatch(targets, supabase, targetType, userId) {
  const validTargets = targets.filter(target => target.container && target.targetId);
  if (!validTargets.length) return;
  validTargets.forEach(({ container }) => {
    container.className = 'content-reaction-bar mt-3 flex flex-wrap items-center gap-2';
    container.replaceChildren();
  });
  const { data: stickers, error: stickerError } = await supabase
    .from('reaction_stickers')
    .select('id, label, image_url')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (stickerError) {
    console.error('Could not load reaction stickers:', stickerError);
    validTargets.forEach(({ container }) => {
      container.textContent = 'Reactions are unavailable right now.';
    });
    return;
  }

  const { data: reactions, error: reactionError } = await supabase
    .from('content_reactions')
    .select('target_id, sticker_id, user_id')
    .eq('target_type', targetType)
    .in('target_id', validTargets.map(target => target.targetId));
  if (reactionError) {
    console.error('Could not load content reactions:', reactionError);
    validTargets.forEach(({ container }) => {
      container.textContent = 'Reactions are unavailable right now.';
    });
    return;
  }

  const reactionsByTarget = new Map();
  (reactions || []).forEach(reaction => {
    if (!reactionsByTarget.has(reaction.target_id)) reactionsByTarget.set(reaction.target_id, []);
    reactionsByTarget.get(reaction.target_id).push(reaction);
  });

  if (!stickers?.length) {
    validTargets.forEach(({ container }) => container.remove());
    return;
  }

  for (const { container, targetId } of validTargets) {
    const targetReactions = reactionsByTarget.get(targetId) || [];
    const counts = new Map();
    const activeByUser = new Set();
    targetReactions.forEach(reaction => {
      counts.set(reaction.sticker_id, (counts.get(reaction.sticker_id) || 0) + 1);
      if (reaction.user_id === userId) activeByUser.add(reaction.sticker_id);
    });

    for (const sticker of stickers) {
      let imageUrl;
      try {
        const url = new URL(sticker.image_url);
        if (!['http:', 'https:'].includes(url.protocol)) continue;
        imageUrl = url.href;
      } catch {
        continue;
      }

      const button = document.createElement('button');
      button.type = 'button';
      button.className = `inline-flex min-h-9 items-center gap-1 rounded-full border px-2 py-1 text-xs transition ${
        activeByUser.has(sticker.id)
          ? 'border-cyan-400 bg-cyan-900/60 text-cyan-100'
          : 'border-gray-700 bg-gray-900/60 text-gray-300 hover:border-gray-500'
      }`;
      button.setAttribute('aria-label', `${sticker.label}: ${counts.get(sticker.id) || 0} reactions`);
      button.title = userId ? `React with ${sticker.label}` : `Sign in to react with ${sticker.label}`;

      const image = document.createElement('img');
      image.src = imageUrl;
      image.alt = '';
      image.loading = 'lazy';
      image.className = 'h-6 w-6 object-contain';
      button.append(image);

      const count = document.createElement('span');
      count.textContent = String(counts.get(sticker.id) || 0);
      button.append(count);

      button.addEventListener('click', async () => {
        if (!userId) {
          window.location.hash = '#/auth';
          return;
        }
        button.disabled = true;
        try {
          const { error } = await supabase.rpc('toggle_content_reaction', {
            p_target_type: targetType,
            p_target_id: targetId,
            p_sticker_id: sticker.id,
          });
          if (error) throw error;
          await mountContentReactionBatch(validTargets, supabase, targetType, userId);
        } catch (error) {
          console.error('Could not update content reaction:', error);
          button.disabled = false;
          button.title = `Could not update reaction: ${error.message}`;
        }
      });
      container.append(button);
    }

    if (!container.childElementCount) container.remove();
  }
}
