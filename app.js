/**
 * =====================================================
 * SocialPost App — app.js
 * Features:
 *   - Create, Edit, Delete, Like posts
 *   - Bootstrap Modal for editing (mandatory)
 *   - LocalStorage persistence (bonus)
 *   - Character counter (bonus)
 *   - Search by username (bonus)
 *   - Dark mode toggle (bonus)
 * =====================================================
 */

/* =====================================================
   CONSTANTS & STATE
   ===================================================== */

/** Storage key for LocalStorage */
const STORAGE_KEY = "socialpost_posts";

/** Avatar background color pool for variety */
const AVATAR_COLORS = [
  "#1877f2", "#e91e8c", "#ff6b6b", "#4ecdc4",
  "#a29bfe", "#fd79a8", "#00b894", "#fdcb6e",
  "#6c5ce7", "#e17055", "#00cec9", "#d63031"
];

/**
 * In-memory array of post objects.
 * Each post: { id, username, content, time, likes, liked, color }
 */
let postsArray = [];

/** ID of the post currently being edited (set when modal opens) */
let editingPostId = null;

/** Bootstrap Modal instance (initialized on DOMContentLoaded) */
let editModalInstance = null;

/* =====================================================
   DOM REFERENCES
   ===================================================== */
const usernameInput   = document.getElementById("usernameInput");
const postContent     = document.getElementById("postContent");
const postBtn         = document.getElementById("postBtn");
const charCounter     = document.getElementById("charCounter");
const postsFeed       = document.getElementById("postsFeed");
const emptyState      = document.getElementById("emptyState");
const searchInput     = document.getElementById("searchInput");
const searchInputMob  = document.getElementById("searchInputMobile");
const searchNotice    = document.getElementById("searchNotice");
const searchNoticeText= document.getElementById("searchNoticeText");
const clearSearchBtn  = document.getElementById("clearSearchBtn");
const noSearchResult  = document.getElementById("noSearchResult");
const themeToggle     = document.getElementById("themeToggle");
const themeIcon       = document.getElementById("themeIcon");
const editPostContent = document.getElementById("editPostContent");
const editCharCounter = document.getElementById("editCharCounter");
const updatePostBtn   = document.getElementById("updatePostBtn");
const totalPostsStat  = document.getElementById("totalPostsStat");
const totalLikesStat  = document.getElementById("totalLikesStat");
const appToast        = document.getElementById("appToast");
const toastMessage    = document.getElementById("toastMessage");
const toastIcon       = document.getElementById("toastIcon");

/* =====================================================
   INITIALIZATION
   ===================================================== */

/**
 * Runs once the DOM is ready.
 * Loads persisted data and wires all event listeners.
 */
document.addEventListener("DOMContentLoaded", function () {
  // Initialize Bootstrap modal
  editModalInstance = new bootstrap.Modal(document.getElementById("editModal"));

  // Load posts from LocalStorage
  loadPostsFromStorage();

  // Render the feed
  renderFeed();

  // Restore saved theme (dark/light)
  applySavedTheme();

  // Wire up events
  attachEventListeners();
});

/* =====================================================
   EVENT LISTENERS
   ===================================================== */

/**
 * Attaches all event listeners centrally.
 * No inline JS used — all handlers are here.
 */
function attachEventListeners() {
  // Post button
  postBtn.addEventListener("click", handleCreatePost);

  // Allow Ctrl+Enter to submit post
  postContent.addEventListener("keydown", function (e) {
    if (e.ctrlKey && e.key === "Enter") handleCreatePost();
  });

  // Character counter — main textarea
  postContent.addEventListener("input", function () {
    updateCharCounter(this, charCounter, 500);
  });

  // Character counter — edit modal textarea
  editPostContent.addEventListener("input", function () {
    updateCharCounter(this, editCharCounter, 500);
  });

  // Update post button inside modal
  updatePostBtn.addEventListener("click", handleUpdatePost);

  // Search inputs (both desktop and mobile)
  searchInput.addEventListener("input", handleSearch);
  searchInputMob.addEventListener("input", function () {
    searchInput.value = this.value;
    handleSearch();
  });

  // Clear search button
  clearSearchBtn.addEventListener("click", clearSearch);

  // Dark mode toggle
  themeToggle.addEventListener("click", toggleTheme);

  // Close any open dropdown when clicking outside
  document.addEventListener("click", closeAllDropdowns);
}

/* =====================================================
   CREATE POST
   ===================================================== */

/**
 * Handles creation of a new post.
 * Validates inputs, builds post object, saves, and renders.
 */
function handleCreatePost() {
  const username = usernameInput.value.trim();
  const content  = postContent.value.trim();

  // Validation — empty check
  if (!username && !content) {
    showToast("Please enter your name and post content!", "danger");
    shakeElement(usernameInput);
    return;
  }
  if (!username) {
    showToast("Please enter your username!", "danger");
    shakeElement(usernameInput);
    usernameInput.focus();
    return;
  }
  if (!content) {
    showToast("Post content cannot be empty!", "danger");
    shakeElement(postContent);
    postContent.focus();
    return;
  }

  // Build new post object
  const newPost = {
    id:       generateId(),
    username: username,
    content:  content,
    time:     new Date().toISOString(),
    likes:    0,
    liked:    false,
    color:    getRandomColor()
  };

  // Prepend to array (newest first)
  postsArray.unshift(newPost);

  // Persist to LocalStorage
  savePostsToStorage();

  // Clear inputs
  postContent.value = "";
  updateCharCounter(postContent, charCounter, 500);

  // Re-render feed
  renderFeed();

  // Success feedback
  showToast(`Post published, ${username}! 🎉`);
  postContent.focus();
}

/* =====================================================
   DELETE POST
   ===================================================== */

/**
 * Handles post deletion.
 * Shows confirmation before removing.
 * @param {string} postId - The ID of the post to delete
 */
function handleDeletePost(postId) {
  // Confirmation alert (required)
  const confirmed = confirm("Are you sure you want to delete this post? This action cannot be undone.");

  if (!confirmed) return;

  // Remove from array
  postsArray = postsArray.filter(function (p) { return p.id !== postId; });

  // Save to LocalStorage
  savePostsToStorage();

  // Re-render
  renderFeed();

  showToast("Post deleted successfully.", "danger");
}

/* =====================================================
   EDIT POST — MODAL FLOW
   ===================================================== */

/**
 * Opens the Bootstrap modal pre-filled with the post content.
 * @param {string} postId - The ID of the post to edit
 */
function openEditModal(postId) {
  const post = postsArray.find(function (p) { return p.id === postId; });
  if (!post) return;

  // Store which post is being edited
  editingPostId = postId;

  // Pre-fill the modal textarea
  editPostContent.value = post.content;
  updateCharCounter(editPostContent, editCharCounter, 500);

  // Open Bootstrap modal
  editModalInstance.show();

  // Focus textarea after modal opens
  document.getElementById("editModal").addEventListener("shown.bs.modal", function focusEdit() {
    editPostContent.focus();
    editPostContent.setSelectionRange(editPostContent.value.length, editPostContent.value.length);
    document.getElementById("editModal").removeEventListener("shown.bs.modal", focusEdit);
  });
}

/**
 * Handles the Update button click inside the edit modal.
 * Saves new content and closes the modal.
 */
function handleUpdatePost() {
  const newContent = editPostContent.value.trim();

  if (!newContent) {
    showToast("Post content cannot be empty!", "danger");
    shakeElement(editPostContent);
    return;
  }

  // Find and update the post
  const postIndex = postsArray.findIndex(function (p) { return p.id === editingPostId; });
  if (postIndex === -1) return;

  postsArray[postIndex].content = newContent;

  // Persist
  savePostsToStorage();

  // Close modal automatically
  editModalInstance.hide();

  // Re-render feed
  renderFeed();

  showToast("Post updated successfully! ✏️");
  editingPostId = null;
}

/* =====================================================
   LIKE POST
   ===================================================== */

/**
 * Toggles the like on a post.
 * Each click adds +1 (toggle allows un-liking too for better UX).
 * @param {string} postId - The ID of the post
 */
function handleLikePost(postId) {
  const post = postsArray.find(function (p) { return p.id === postId; });
  if (!post) return;

  // Toggle liked state
  if (post.liked) {
    post.likes = Math.max(0, post.likes - 1);
    post.liked = false;
  } else {
    post.likes += 1;
    post.liked = true;
  }

  // Persist
  savePostsToStorage();

  // Update stats sidebar
  updateStats();

  // Update only the like button (no full re-render for smooth UX)
  const likeBtn   = document.querySelector(`[data-post-id="${postId}"] .like-btn`);
  const likeCount = document.querySelector(`[data-post-id="${postId}"] .like-count`);

  if (likeBtn && likeCount) {
    likeCount.textContent = post.likes;

    if (post.liked) {
      likeBtn.classList.add("liked");
    } else {
      likeBtn.classList.remove("liked");
    }

    // Animate the icon
    const icon = likeBtn.querySelector("i");
    if (icon) {
      icon.classList.remove("bi-heart", "bi-heart-fill");
      icon.classList.add(post.liked ? "bi-heart-fill" : "bi-heart");
    }
  }
}

/* =====================================================
   RENDER FEED
   ===================================================== */

/**
 * Renders all posts (or filtered posts) to the DOM.
 * Respects current search filter.
 */
function renderFeed() {
  const query = searchInput.value.trim().toLowerCase();

  // Determine which posts to show
  let filteredPosts = postsArray;
  if (query) {
    filteredPosts = postsArray.filter(function (p) {
      return p.username.toLowerCase().includes(query);
    });
  }

  // Clear feed
  postsFeed.innerHTML = "";

  // Hide / show empty states
  emptyState.classList.add("d-none");
  noSearchResult.classList.add("d-none");

  if (postsArray.length === 0) {
    // No posts at all
    emptyState.classList.remove("d-none");
  } else if (filteredPosts.length === 0 && query) {
    // Search returned nothing
    noSearchResult.classList.remove("d-none");
  } else {
    // Render each post card
    filteredPosts.forEach(function (post) {
      const card = buildPostCard(post);
      postsFeed.appendChild(card);
    });
  }

  // Update sidebar stats
  updateStats();
}

/**
 * Builds and returns a post card DOM element.
 * @param {Object} post - The post data object
 * @returns {HTMLElement}
 */
function buildPostCard(post) {
  const card = document.createElement("div");
  card.className = "post-card";
  card.setAttribute("data-post-id", post.id);

  const timeDisplay = formatTime(post.time);
  const initials    = getInitials(post.username);
  const likedClass  = post.liked ? "liked" : "";
  const heartIcon   = post.liked ? "bi-heart-fill" : "bi-heart";

  card.innerHTML = `
    <!-- Post Header -->
    <div class="post-card-header">
      <div class="post-user-info">
        <div class="post-avatar" style="background: ${post.color};">
          ${initials}
        </div>
        <div>
          <span class="post-username">${escapeHtml(post.username)}</span>
          <span class="post-time">
            <i class="bi bi-clock"></i> ${timeDisplay}
          </span>
        </div>
      </div>

      <!-- Three-dot Dropdown Menu -->
      <div style="position:relative;">
        <button class="post-menu-btn" onclick="toggleDropdown('${post.id}', event)" title="Options">
          <i class="bi bi-three-dots"></i>
        </button>
        <div class="post-dropdown" id="dropdown-${post.id}">
          <div class="dropdown-option" onclick="openEditModal('${post.id}'); closeAllDropdowns();">
            <i class="bi bi-pencil-fill text-primary"></i> Edit Post
          </div>
          <div class="dropdown-option danger" onclick="handleDeletePost('${post.id}')">
            <i class="bi bi-trash-fill"></i> Delete Post
          </div>
        </div>
      </div>
    </div>

    <!-- Post Content -->
    <div class="post-body">
      <p class="post-text">${escapeHtml(post.content)}</p>
    </div>

    <!-- Divider -->
    <hr class="post-divider" />

    <!-- Action Buttons -->
    <div class="post-actions">
      <!-- Like Button -->
      <button class="action-btn like-btn ${likedClass}" onclick="handleLikePost('${post.id}')">
        <i class="bi ${heartIcon}"></i>
        <span class="like-count">${post.likes}</span>
        Like
      </button>

      <!-- Comment Button (UI only) -->
      <button class="action-btn">
        <i class="bi bi-chat-dots"></i>
        Comment
      </button>

      <!-- Share Button (UI only) -->
      <button class="action-btn">
        <i class="bi bi-share"></i>
        Share
      </button>
    </div>
  `;

  return card;
}

/* =====================================================
   SEARCH FEATURE (BONUS)
   ===================================================== */

/**
 * Handles real-time search input.
 * Syncs both mobile and desktop inputs.
 */
function handleSearch() {
  const query = searchInput.value.trim();

  // Sync mobile input
  if (searchInputMob.value !== searchInput.value) {
    searchInputMob.value = searchInput.value;
  }

  if (query) {
    searchNotice.classList.remove("d-none");
    searchNoticeText.textContent = `Showing results for: "${query}"`;
  } else {
    searchNotice.classList.add("d-none");
  }

  renderFeed();
}

/**
 * Clears the search and shows all posts.
 */
function clearSearch() {
  searchInput.value    = "";
  searchInputMob.value = "";
  searchNotice.classList.add("d-none");
  renderFeed();
}

/* =====================================================
   DARK MODE TOGGLE (BONUS)
   ===================================================== */

/**
 * Toggles between dark and light mode.
 * Persists preference in LocalStorage.
 */
function toggleTheme() {
  const html        = document.documentElement;
  const currentTheme= html.getAttribute("data-theme");
  const newTheme    = currentTheme === "dark" ? "light" : "dark";

  html.setAttribute("data-theme", newTheme);
  localStorage.setItem("socialpost_theme", newTheme);

  // Update icon
  if (newTheme === "dark") {
    themeIcon.classList.remove("bi-moon-stars-fill");
    themeIcon.classList.add("bi-sun-fill");
  } else {
    themeIcon.classList.remove("bi-sun-fill");
    themeIcon.classList.add("bi-moon-stars-fill");
  }
}

/**
 * Reads saved theme from LocalStorage and applies it on load.
 */
function applySavedTheme() {
  const saved = localStorage.getItem("socialpost_theme");
  if (saved === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    themeIcon.classList.remove("bi-moon-stars-fill");
    themeIcon.classList.add("bi-sun-fill");
  }
}

/* =====================================================
   CHARACTER COUNTER (BONUS)
   ===================================================== */

/**
 * Updates the character counter display.
 * Changes color as limit approaches.
 * @param {HTMLTextAreaElement} textarea  - The textarea element
 * @param {HTMLElement}         counter   - The counter label element
 * @param {number}              maxLength - Maximum character limit
 */
function updateCharCounter(textarea, counter, maxLength) {
  const length = textarea.value.length;
  counter.textContent = `${length} / ${maxLength}`;

  // Reset classes
  counter.classList.remove("warn", "danger");

  if (length >= maxLength * 0.9) {
    counter.classList.add("danger");  // >= 90% — red
  } else if (length >= maxLength * 0.7) {
    counter.classList.add("warn");    // >= 70% — yellow
  }
}

/* =====================================================
   DROPDOWN MENU
   ===================================================== */

/**
 * Toggles the three-dot dropdown for a specific post.
 * Closes all others first.
 * @param {string}     postId - The post's ID
 * @param {MouseEvent} event  - Click event (to stop propagation)
 */
function toggleDropdown(postId, event) {
  event.stopPropagation();

  const dropdown = document.getElementById("dropdown-" + postId);
  const isOpen   = dropdown.classList.contains("open");

  // Close all
  closeAllDropdowns();

  // Open this one if it was closed
  if (!isOpen) {
    dropdown.classList.add("open");
  }
}

/**
 * Closes all open dropdowns.
 * Called on document click.
 */
function closeAllDropdowns() {
  document.querySelectorAll(".post-dropdown.open").forEach(function (d) {
    d.classList.remove("open");
  });
}

/* =====================================================
   LOCALSTORAGE (BONUS)
   ===================================================== */

/**
 * Saves the current postsArray to LocalStorage as JSON.
 */
function savePostsToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(postsArray));
  } catch (e) {
    console.warn("LocalStorage save failed:", e);
  }
}

/**
 * Loads posts from LocalStorage into postsArray.
 * Gracefully handles corrupt data.
 */
function loadPostsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      postsArray = JSON.parse(raw);
    }
  } catch (e) {
    console.warn("LocalStorage load failed:", e);
    postsArray = [];
  }
}

/* =====================================================
   STATS SIDEBAR
   ===================================================== */

/**
 * Updates the sidebar stats (total posts & total likes).
 */
function updateStats() {
  if (!totalPostsStat || !totalLikesStat) return;

  const totalPosts = postsArray.length;
  const totalLikes = postsArray.reduce(function (sum, p) { return sum + p.likes; }, 0);

  totalPostsStat.textContent = totalPosts;
  totalLikesStat.textContent = totalLikes;
}

/* =====================================================
   TOAST NOTIFICATION
   ===================================================== */

/** Timer reference for auto-hiding toast */
let toastTimer = null;

/**
 * Shows a toast notification.
 * @param {string} message - The message to display
 * @param {string} type    - "success" (default) or "danger"
 */
function showToast(message, type) {
  if (!appToast) return;

  // Clear previous timer
  clearTimeout(toastTimer);

  // Set message
  toastMessage.textContent = message;

  // Set style
  appToast.classList.remove("toast-danger");
  if (type === "danger") {
    appToast.classList.add("toast-danger");
    toastIcon.className = "bi bi-exclamation-circle-fill toast-icon";
  } else {
    toastIcon.className = "bi bi-check-circle-fill toast-icon";
  }

  // Show
  appToast.classList.add("show");

  // Auto-hide after 3 seconds
  toastTimer = setTimeout(function () {
    appToast.classList.remove("show");
  }, 3000);
}

/* =====================================================
   UTILITY FUNCTIONS
   ===================================================== */

/**
 * Generates a unique ID string.
 * @returns {string}
 */
function generateId() {
  return "post_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);
}

/**
 * Returns a deterministic color from AVATAR_COLORS pool.
 * @returns {string} A hex color string
 */
function getRandomColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

/**
 * Returns 1–2 uppercase initials from a username.
 * @param {string} name
 * @returns {string}
 */
function getInitials(name) {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/**
 * Formats an ISO date string into a human-readable relative time.
 * @param {string} isoString
 * @returns {string} e.g. "2 mins ago", "3 hours ago", "Jan 5"
 */
function formatTime(isoString) {
  const now  = new Date();
  const date = new Date(isoString);
  const diff = Math.floor((now - date) / 1000); // seconds

  if (diff < 60)           return "Just now";
  if (diff < 3600)         return Math.floor(diff / 60) + " min ago";
  if (diff < 86400)        return Math.floor(diff / 3600) + " hr ago";
  if (diff < 604800)       return Math.floor(diff / 86400) + " days ago";

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Escapes HTML special characters to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&#039;");
}

/**
 * Adds a quick shake animation to an element for validation feedback.
 * @param {HTMLElement} el
 */
function shakeElement(el) {
  el.style.transition = "transform 0.08s ease";
  let count = 0;
  const interval = setInterval(function () {
    el.style.transform = count % 2 === 0 ? "translateX(6px)" : "translateX(-6px)";
    count++;
    if (count > 5) {
      clearInterval(interval);
      el.style.transform = "translateX(0)";
    }
  }, 60);
}
