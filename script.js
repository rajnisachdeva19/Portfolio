// -------- Settings --------
const ENABLE_REALTIME = true; // set to false if you don't want live updates
// --------------------------

// Safe render of a single review into a container
function displayReview(review, container) {
  const r_item = document.createElement('div');
  r_item.classList.add('review-item');

  const textP = document.createElement('p');
  textP.textContent = review.text; // SAFE: no innerHTML / no HTML injection

  const dateP = document.createElement('p');
  dateP.classList.add('review-date');
  const ts = review.timestamp ? new Date(review.timestamp) : new Date();
  dateP.textContent = ts.toLocaleString();

  r_item.appendChild(textP);
  r_item.appendChild(dateP);
  container.prepend(r_item); // newest first
}

// Load all reviews for a given post_id
async function loadReviews(postId, container) {
  container.innerHTML = '<p>Loading…</p>';

  const { data, error } = await window.supabase
    .from('reviews')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Load error:', error);
    container.innerHTML = '<p>Failed to load comments.</p>';
    return;
  }

  container.innerHTML = '';
  for (const row of data) {
    displayReview({ text: row.text, timestamp: row.created_at }, container);
  }
}

// Insert a new review for post_id
async function saveReview(postId, text, container, textarea) {
  const cleaned = (text || '').trim();
  if (!cleaned) return;

  const { data, error } = await window.supabase
    .from('reviews')
    .insert([{ post_id: postId, text: cleaned }])
    .select()
    .single();

  if (error) {
    console.error('Insert error:', error);
    alert('Could not submit comment, please try again.');
    return;
  }

  displayReview({ text: data.text, timestamp: data.created_at }, container);
  if (textarea) textarea.value = '';
}

// Optional: receive realtime inserts for a specific post_id
function setupRealtime(postId, container) {
  if (!ENABLE_REALTIME) return null;

  const channel = window.supabase.channel(`reviews-insert-${postId}`);

  channel.on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'reviews', filter: `post_id=eq.${postId}` },
    (payload) => {
      const row = payload.new;
      displayReview({ text: row.text, timestamp: row.created_at }, container);
    }
  );

  channel.subscribe();
  return channel;
}

document.addEventListener('DOMContentLoaded', () => {
  // Global feedback section wired to a shared post_id
  const g_form = document.getElementById('review-form');
  const g_textarea = document.getElementById('review-text');
  const g_display = document.getElementById('reviews-display');
  const GLOBAL_POST_ID = 'global-feedback';

  if (g_display) {
    loadReviews(GLOBAL_POST_ID, g_display);
    setupRealtime(GLOBAL_POST_ID, g_display);
  }

  if (g_form && g_textarea && g_display) {
    g_form.addEventListener('submit', (event) => {
      event.preventDefault();
      saveReview(GLOBAL_POST_ID, g_textarea.value, g_display, g_textarea);
    });
  }

  // Per-post comment sections
  const p_items = document.querySelectorAll('.post-item');
  p_items.forEach((postItem) => {
    const p_id = postItem.dataset.postId;
    const p_form = postItem.querySelector('.post-review-form');
    const p_textarea = p_form ? p_form.querySelector('textarea') : null;
    const p_display = postItem.querySelector('.post-reviews-display');

    if (p_id && p_display) {
      loadReviews(p_id, p_display);
      setupRealtime(p_id, p_display);
    }

    if (p_id && p_form && p_textarea && p_display) {
      p_form.addEventListener('submit', (event) => {
        event.preventDefault();
        saveReview(p_id, p_textarea.value, p_display, p_textarea);
      });
    }
  });
});
