// ui/Renderer.js
/**
 * UI Renderer: Pure DOM manipulation for the popup.
 */
window.YTA.Popup.Renderer = {
  expandedItems: new Set(),

  /**
   * Renders the leaderboard list
   */
  renderLeaderboard: function(listEl, items, isHistory = false) {
    while (listEl.firstChild) listEl.removeChild(listEl.firstChild);
    if (!items) return;

    items.forEach((item, index) => {
      const isChannel = item.label.startsWith("Channel:");
      const cleanName = item.label.replace(/^(Channel|Tag): /, "");
      const color = isChannel ? "#f87171" : "#60a5fa";
      const typeLabel = isChannel ? "CHANNEL" : "TAG";
      const hasTabs = item.tabs && item.tabs.length > 0;
      const isExpanded = this.expandedItems.has(item.label);

      const li = document.createElement("li");
      li.className = "entry-container";

      const entryHeader = document.createElement("div");
      entryHeader.className = "entry clickable";
      if (hasTabs) {
        entryHeader.addEventListener("click", () => {
          if (this.expandedItems.has(item.label)) {
            this.expandedItems.delete(item.label);
          } else {
            this.expandedItems.add(item.label);
          }
          // Request a re-render from the controller
          window.YTA.Popup.Controller.refreshUI();
        });
      }

      const arrow = document.createElement("span");
      arrow.className = `toggle-arrow ${isExpanded ? 'expanded' : ''}`;
      arrow.textContent = hasTabs ? "▶" : "";
      entryHeader.appendChild(arrow);

      const rank = document.createElement("span");
      rank.className = "rank";
      rank.textContent = `${index + 1}.`;
      entryHeader.appendChild(rank);

      const badge = document.createElement("span");
      badge.className = "badge";
      badge.style.backgroundColor = color;
      badge.textContent = typeLabel;
      entryHeader.appendChild(badge);

      const infoWrapper = document.createElement("div");
      infoWrapper.style.flexGrow = "1";
      infoWrapper.style.whiteSpace = "nowrap";
      infoWrapper.style.overflow = "hidden";
      infoWrapper.style.textOverflow = "ellipsis";
      infoWrapper.style.marginRight = "10px";

      const name = document.createElement("strong");
      name.textContent = cleanName;
      infoWrapper.appendChild(name);

      if (!isHistory && item.tabs) {
        const anyPlaying = item.tabs.some(t => t.isPlaying);
        if (anyPlaying) {
          const liveBadge = document.createElement("span");
          liveBadge.className = "playing-badge";
          liveBadge.textContent = "[PLAYING]";
          infoWrapper.appendChild(liveBadge);
        }
      }

      const count = document.createElement("span");
      count.style.color = "#6b7280";
      count.style.fontSize = "10px";
      count.textContent = ` (${item.count}x)`;
      infoWrapper.appendChild(count);

      entryHeader.appendChild(infoWrapper);

      const duration = document.createElement("span");
      duration.className = "duration-value";
      if (isHistory) {
        duration.textContent = formatDuration(item.watchTime || 0);
      } else {
        const watched = formatDuration(item.watchTime || 0);
        const total = formatDuration(item.duration || 0);
        duration.textContent = `${watched} / ${total}`;
      }
      entryHeader.appendChild(duration);

      li.appendChild(entryHeader);

      if (hasTabs && isExpanded) {
        const childrenUl = document.createElement("ul");
        childrenUl.className = "entry-children";
        item.tabs.forEach(tab => {
          const childLi = document.createElement("li");
          childLi.className = "child-tab";
          if (!isHistory && tab.isLive && tab.isPlaying) {
             const badgeSpan = document.createElement("span");
             badgeSpan.className = "playing-badge-small";
             badgeSpan.textContent = "[PLAYING]";
             childLi.appendChild(badgeSpan);
          }
          const titleSpan = document.createElement("span");
          titleSpan.textContent = tab.title;
          childLi.appendChild(titleSpan);
          childLi.addEventListener("click", (e) => {
            e.stopPropagation();
            browser.tabs.update(tab.tabId, { active: true }).then(t => {
              if (t && t.windowId) browser.windows.update(t.windowId, { focused: true });
            });
          });
          childrenUl.appendChild(childLi);
        });
        li.appendChild(childrenUl);
      }
      listEl.appendChild(li);
    });
  }
};
