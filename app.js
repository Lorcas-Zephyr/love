"use strict";

(() => {
  const album = window.OUR_STORY;
  const $ = (id) => document.getElementById(id);
  if (!album?.events?.length) {
    $("timeline-list").textContent = "照片索引还没有生成，请检查 data.js。";
    return;
  }

  const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const photoEvents = album.events;
  const allPhotos = photoEvents.flatMap((event) => event.photos.map((photo) => ({ ...photo, event })));
  const photoById = new Map(allPhotos.map((photo) => [photo.id, photo]));
  const eventById = new Map(photoEvents.map((event) => [event.id, event]));
  const state = { year: "all", query: "" };
  let openEvent;
  let activeIndex = 0;
  let lastTrigger;
  let searchTimer;
  let photoTransition;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const photoStack = $("stack-front").parentElement;

  function shanghaiDate(now = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
    const part = (type) => parts.find((item) => item.type === type).value;
    return `${part("year")}-${part("month")}-${part("day")}`;
  }

  function daysSince(date) {
    return Math.max(0, Math.floor((Date.parse(`${shanghaiDate()}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86400000));
  }

  function dateLabel(date) {
    if (!date) return "日期待补";
    return date.replaceAll("-", ".");
  }

  function searchText(event) {
    return `${event.title} ${event.place} ${event.date} ${event.fullTitle}`.toLocaleLowerCase();
  }

  function stackPreview(event) {
    const previews = event.photos.slice(0, 3);
    return `<span class="timeline-stack" aria-hidden="true">${previews.map((photo, index) => `<img class="timeline-stack-${index + 1}" src="${escape(photo.thumbnail)}" alt="" loading="lazy" decoding="async" />`).join("")}</span>`;
  }

  function cardHtml(event, index) {
    const date = dateLabel(event.date);
    const ordinal = String(index + 1).padStart(2, "0");
    const words = event.kind === "milestone" ? "我们相识啦" : event.title;
    return `<article class="timeline-entry${event.kind === "milestone" ? " is-milestone" : ""}" data-side="${index % 2 ? "right" : "left"}">
      <span class="timeline-dot" aria-hidden="true"></span>
      <button class="timeline-card" type="button" data-event="${escape(event.id)}" aria-label="打开 ${escape(date)} · ${escape(words)} · ${event.photos.length} 张精选照片">
        <span class="timeline-card-top"><span class="timeline-ordinal">${ordinal}</span><time datetime="${escape(event.date || "")}">${escape(date)}</time><span class="timeline-open" aria-hidden="true">↗</span></span>
        <span class="timeline-card-title">${escape(words)}</span>
        <span class="timeline-card-bottom"><span>${escape(event.place)}</span><span>${event.photos.length} 张精选</span></span>
        ${stackPreview(event)}
      </button>
    </article>`;
  }

  function renderYears() {
    const years = [...new Set(photoEvents.map((event) => event.date?.slice(0, 4)).filter(Boolean))].sort();
    const items = [{ value: "all", label: "全部日子" }, ...years.map((year) => ({ value: year, label: year }))];
    $("year-filters").innerHTML = items.map(({ value, label }) => `<button type="button" data-year="${value}" aria-pressed="${state.year === value}" class="${state.year === value ? "active" : ""}">${label}</button>`).join("");
  }

  function filteredEvents() {
    const query = state.query.trim().toLocaleLowerCase();
    return photoEvents.filter((event) => {
      if (state.year !== "all" && !event.date?.startsWith(state.year)) return false;
      return !query || searchText(event).includes(query);
    });
  }

  function renderTimeline() {
    const events = filteredEvents();
    const total = events.reduce((sum, event) => sum + event.photos.length, 0);
    $("timeline-summary").textContent = `${events.length} 个日子 · ${total} 张精选`;
    $("empty-state").hidden = events.length > 0;
    $("timeline-list").innerHTML = events.map(cardHtml).join("");
    // The undated handwritten letter remains in the timeline and falls after dated entries.
  }

  function paintStackCard(element, photo, layer) {
    element.replaceChildren();
    if (!photo) {
      element.hidden = true;
      return;
    }
    element.hidden = false;
    const image = document.createElement("img");
    image.src = photo.preview;
    image.alt = layer === "front" ? `${openEvent.title} · 第 ${activeIndex + 1} 张` : "";
    image.loading = "eager";
    image.decoding = "async";
    image.className = "stack-photo";
    if (photo.type === "截屏") image.classList.add("is-screenshot");
    element.append(image);
    if (layer === "front" && photo.type === "截屏") {
      const badge = document.createElement("span");
      badge.className = "stack-badge";
      badge.textContent = "屏幕里的我们";
      element.append(badge);
    }
  }

  function renderStack() {
    if (!openEvent) return;
    const photo = openEvent.photos[activeIndex];
    const oneAhead = openEvent.photos[activeIndex + 1];
    const twoAhead = openEvent.photos[activeIndex + 2];
    paintStackCard($("stack-back-two"), twoAhead, "back");
    paintStackCard($("stack-back-one"), oneAhead, "back");
    paintStackCard($("stack-front"), photo, "front");
    const date = dateLabel(openEvent.date);
    $("memory-date").dateTime = openEvent.date || "";
    $("memory-date").textContent = `${date}${photo?.time ? ` · ${photo.time}` : ""}`;
    $("memory-title").textContent = openEvent.title;
    $("memory-place").textContent = openEvent.place;
    $("photo-count").textContent = `${String(activeIndex + 1).padStart(2, "0")} / ${String(openEvent.photos.length).padStart(2, "0")}`;
    updatePhotoControls();
  }

  function updatePhotoControls() {
    if (!openEvent) return;
    $("photo-prev").disabled = Boolean(photoTransition) || activeIndex === 0;
    $("photo-next").disabled = Boolean(photoTransition) || activeIndex >= openEvent.photos.length - 1;
    $("stack-front").setAttribute("aria-disabled", String(Boolean(photoTransition)));
    $("stack-front").setAttribute("aria-label", activeIndex < openEvent.photos.length - 1 ? "查看下一张照片" : "已经是最后一张照片");
  }

  function finishPhotoTransition() {
    if (!photoTransition) return;
    const { animations, outgoing } = photoTransition;
    photoTransition = null;
    animations.forEach((animation) => animation.cancel());
    outgoing.remove();
    photoStack.classList.remove("is-turning");
    updatePhotoControls();
  }

  function showEvent(event, trigger) {
    if (!event) return;
    finishPhotoTransition();
    openEvent = event;
    activeIndex = 0;
    lastTrigger = trigger;
    renderStack();
    if (!$("memory-dialog").open) {
      $("memory-dialog").showModal();
      document.body.classList.add("dialog-open");
    }
  }

  function stepPhoto(delta) {
    if (!openEvent || photoTransition) return;
    const next = activeIndex + delta;
    if (next < 0 || next >= openEvent.photos.length) return;
    const front = $("stack-front");
    const backOne = $("stack-back-one");
    const backTwo = $("stack-back-two");
    const shouldAnimate = !reducedMotion.matches && typeof front.animate === "function";
    const previousTransforms = shouldAnimate ? [front, backOne, backTwo].map((card) => getComputedStyle(card).transform) : [];
    const outgoing = shouldAnimate ? front.cloneNode(true) : null;
    activeIndex = next;
    renderStack();
    if (!shouldAnimate) return;

    // Keep the old photo visible while the next card rises from the stack.
    outgoing.removeAttribute("id");
    outgoing.removeAttribute("aria-label");
    outgoing.setAttribute("aria-hidden", "true");
    outgoing.tabIndex = -1;
    outgoing.disabled = true;
    outgoing.className = "stack-card stack-outgoing";
    photoStack.append(outgoing);
    photoStack.classList.add("is-turning");
    const transition = { animations: [], outgoing };
    photoTransition = transition;
    updatePhotoControls();
    const timing = { duration: 540, easing: "cubic-bezier(.22,.68,.28,1)", fill: "both" };
    const animateCard = (card, keyframes, options = {}) => {
      transition.animations.push(card.animate(keyframes, { ...timing, ...options }));
    };

    animateCard(outgoing, [
      { transform: previousTransforms[0], opacity: 1 },
      { transform: `translate(${delta > 0 ? "-42%" : "42%"}, -6%) rotate(${delta > 0 ? -14 : 14}deg) scale(.96)`, opacity: 0 },
    ], { duration: 460 });
    animateCard(front, [
      { transform: delta > 0 ? previousTransforms[1] : "translate(-30%, -4%) rotate(-11deg) scale(.96)", opacity: delta > 0 ? 1 : 0 },
      { transform: getComputedStyle(front).transform, opacity: 1 },
    ]);
    if (!backOne.hidden) animateCard(backOne, [
      { transform: previousTransforms[delta > 0 ? 2 : 0] },
      { transform: getComputedStyle(backOne).transform },
    ]);
    if (!backTwo.hidden) animateCard(backTwo, [
      { transform: delta > 0 ? "translate(0, 16px) rotate(-4deg) scale(.92)" : previousTransforms[1], opacity: delta > 0 ? 0 : 1 },
      { transform: getComputedStyle(backTwo).transform, opacity: 1 },
    ]);
    Promise.all(transition.animations.map((animation) => animation.finished)).then(() => {
      if (photoTransition === transition) finishPhotoTransition();
    }).catch(() => {}); // Closing the dialog cancels any unfinished animation.
  }

  function closeMemory() {
    finishPhotoTransition();
    document.body.classList.remove("dialog-open");
    $("memory-dialog").close();
  }

  function resetFilters() {
    clearTimeout(searchTimer);
    state.year = "all";
    state.query = "";
    $("search").value = "";
    renderYears();
    renderTimeline();
  }

  const coverPhoto = photoById.get(album.coverId);
  if (coverPhoto) $("cover-image").src = coverPhoto.preview;
  $("met-days").textContent = daysSince(album.metDate);
  $("total-photos").textContent = album.photoCount;

  $("year-filters").addEventListener("click", (event) => {
    const filter = event.target.closest("[data-year]");
    if (!filter) return;
    state.year = filter.dataset.year;
    renderYears();
    renderTimeline();
  });
  $("search").addEventListener("input", (event) => {
    state.query = event.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(renderTimeline, 140);
  });
  $("reset-filters").addEventListener("click", resetFilters);
  $("timeline-list").addEventListener("click", (event) => {
    const card = event.target.closest("[data-event]");
    if (card) showEvent(eventById.get(card.dataset.event), card);
  });
  $("dialog-close").addEventListener("click", closeMemory);
  $("stack-front").addEventListener("click", () => stepPhoto(1));
  $("photo-prev").addEventListener("click", () => stepPhoto(-1));
  $("photo-next").addEventListener("click", () => stepPhoto(1));
  $("memory-dialog").addEventListener("click", (event) => { if (event.target === $("memory-dialog")) closeMemory(); });
  $("memory-dialog").addEventListener("cancel", () => {
    finishPhotoTransition();
    document.body.classList.remove("dialog-open");
  });
  $("memory-dialog").addEventListener("close", () => {
    finishPhotoTransition();
    openEvent = null;
    document.body.classList.remove("dialog-open");
    if (lastTrigger?.isConnected) lastTrigger.focus({ preventScroll: true });
  });
  reducedMotion.addEventListener("change", () => {
    if (reducedMotion.matches) finishPhotoTransition();
  });
  document.addEventListener("keydown", (event) => {
    if (!$("memory-dialog").open) return;
    if (event.key === "ArrowRight") { event.preventDefault(); stepPhoto(1); }
    if (event.key === "ArrowLeft") { event.preventDefault(); stepPhoto(-1); }
  });
  renderYears();
  renderTimeline();
})();
