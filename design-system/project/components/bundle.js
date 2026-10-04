/* KSU motion. Every animation runs on GSAP (gsap, ScrollTrigger, SplitText, ScrollSmoother), loaded before this file.
   Classic script, no imports. Assigns window.KSU. Without GSAP, or with reduced motion, the page stays static and complete. */
(function () {
  var gsap = window.gsap, ST = window.ScrollTrigger, Split = window.SplitText, Smoother = window.ScrollSmoother;
  var has = !!(gsap && ST);
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var on = has && !reduce;
  var api = { version: '0.33.0', smoother: null };

  if (has) {
    gsap.registerPlugin.apply(gsap, [ST, Split, Smoother].filter(Boolean));
    ST.config({ ignoreMobileResize: true });
    gsap.defaults({ ease: 'expo.out', duration: 1.1 });
  }

  // Run a callback when the window's width changes. Phones fire resize as the address bar slides in and out,
  // which changes only the height; re-measuring then makes the page twitch.
  function onWidth(fn) {
    var last = window.innerWidth, timer;
    window.addEventListener('resize', function () {
      if (window.innerWidth === last) return;
      last = window.innerWidth;
      clearTimeout(timer);
      timer = setTimeout(fn, 150);
    });
  }

  function all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function shown() { document.documentElement.classList.remove('ksu-motion'); }

  // Size a line of type so it fills its container's width. data-ksu-fit (optional value: fraction of the width, default 1).
  function fit(el) {
    var box = el.parentNode, share = Number(el.getAttribute('data-ksu-fit')) || 1;
    function size() {
      el.style.fontSize = '100px';
      var w = el.getBoundingClientRect().width;
      if (w) el.style.fontSize = (100 * box.clientWidth * share / w).toFixed(2) + 'px';
    }
    size();
    onWidth(function () { size(); if (has) ST.refresh(); });
  }

  // A video cover that becomes the YouTube player when pressed. data-ksu-video="<video id>" on the figure.
  var videos = [];
  function stopVideos() {
    videos.forEach(function (v) {
      if (v.frame) { v.frame.parentNode.removeChild(v.frame); v.frame = null; v.cover.hidden = false; }
    });
  }
  function video(el) {
    var cover = el.querySelector('.ksu-video__cover'), entry = { cover: cover, frame: null };
    if (!cover) return;
    videos.push(entry);
    cover.addEventListener('click', function () {
      stopVideos();
      if (api.pauseAudio) api.pauseAudio();
      var f = document.createElement('iframe');
      f.className = 'ksu-video__frame';
      f.title = cover.getAttribute('aria-label') || 'Video';
      f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      f.allowFullscreen = true;
      var id = encodeURIComponent(el.getAttribute('data-ksu-video'));
      // data-ksu-video-from="tiktok" plays a TikTok in its own player; anything else is a YouTube id.
      f.src = el.getAttribute('data-ksu-video-from') === 'tiktok'
        ? 'https://www.tiktok.com/player/v1/' + id + '?autoplay=1&rel=0&description=0&music_info=0'
        : 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0&playsinline=1';
      // TikTok's player starts silent. The press on the cover is the visitor asking for the video, so once the player
      // reports ready (and again when it first plays) it is told to unmute and play.
      if (el.getAttribute('data-ksu-video-from') === 'tiktok') {
        var say = function (type) { if (f.contentWindow) f.contentWindow.postMessage({ type: type, 'x-tiktok-player': true }, 'https://www.tiktok.com'); };
        var tries = 0;
        var hear = function (e) {
          if (e.source !== f.contentWindow || !e.data || !e.data['x-tiktok-player']) return;
          if (!f.isConnected) { window.removeEventListener('message', hear); return; }
          if (e.data.type === 'onPlayerReady' || (e.data.type === 'onStateChange' && tries < 3)) { tries++; say('unMute'); say('play'); }
          if (e.data.type === 'onMute' && tries < 3) { tries++; say('unMute'); }
        };
        window.addEventListener('message', hear);
      }
      var holder = document.createElement('div');
      holder.className = cover.className;
      holder.style.cursor = 'auto';
      holder.appendChild(f);
      cover.hidden = true;
      cover.parentNode.insertBefore(holder, cover);
      entry.frame = holder;
    });
  }

  // Smooth scrolling. Needs #smooth-wrapper > #smooth-content around the page; fixed elements stay outside.
  function smooth(opts) {
    if (!on || !Smoother || !document.querySelector('#smooth-wrapper')) return null;
    var config = { smooth: 1.5, effects: true };
    for (var k in (opts || {})) config[k] = opts[k];
    api.smoother = Smoother.create(config);
    all('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var target = a.getAttribute('href').length > 1 && document.querySelector(a.getAttribute('href'));
        if (!target) return;
        e.preventDefault();
        api.smoother.scrollTo(target, true, 'top top');
      });
    });
    return api.smoother;
  }

  // Text reveals on scroll. data-ksu-reveal="lines" (default) | "words" | "read" | "chars" | "scramble".
  function reveal(el) {
    if (!on || !Split) return;
    var mode = el.getAttribute('data-ksu-reveal') || 'lines';
    var st = { trigger: el, start: 'top 88%', once: true };
    if (mode === 'scramble') {
      // Letters land in random order, gaps left open until each arrives.
      var s = Split.create(el, { type: 'words,chars' });
      gsap.from(s.chars, { autoAlpha: 0, duration: 0.01, ease: 'none', stagger: { amount: 0.9, from: 'random' }, scrollTrigger: st });
    } else if (mode === 'words') {
      // Each word swings up from its baseline; the block replays if the visitor scrolls back above it.
      var w = Split.create(el, { type: 'words' });
      gsap.set(w.words, { transformPerspective: 1000, transformOrigin: '50% 100%' });
      var tl = gsap.from(w.words, { rotationX: -90, autoAlpha: 0, duration: 0.8, ease: 'power2.out', stagger: { amount: 0.8 }, paused: true });
      ST.create({ trigger: el, start: 'top 85%', onEnter: function () { tl.play(); } });
      ST.create({ trigger: el, start: 'top bottom', onLeaveBack: function () { tl.pause(0); } });
    } else if (mode === 'read') {
      // Reading light: words start dim and reach full strength as the passage is scrolled through.
      var rd = Split.create(el, { type: 'words' });
      gsap.fromTo(rd.words, { opacity: 0.2 }, { opacity: 1, ease: 'none', stagger: 0.1,
        scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 55%', scrub: true } });
    } else if (mode === 'chars') {
      // No mask: these words are set with very tight leading, and a mask as tall as the line would shave the tops of the letters.
      var c = Split.create(el, { type: 'chars' });
      gsap.from(c.chars, { yPercent: 45, autoAlpha: 0, duration: 1.1, stagger: 0.06, scrollTrigger: st });
    } else {
      Split.create(el, {
        type: 'lines', mask: 'lines', autoSplit: true,
        onSplit: function (self) {
          return gsap.from(self.lines, { yPercent: 110, duration: 1, stagger: 0.08, scrollTrigger: st });
        }
      });
    }
  }

  // Entrances on scroll. data-ksu-enter="clip" (photo frames) | "rows" (lists on hairlines) | "tilt" (the promo card, scrubbed).
  function enter(el) {
    if (!on) return;
    var mode = el.getAttribute('data-ksu-enter');
    if (mode === 'tilt') {
      gsap.fromTo(el,
        { xPercent: 14, yPercent: 10, rotationY: -16, rotationZ: 4, transformPerspective: 1200, transformOrigin: '100% 100%' },
        { xPercent: 0, yPercent: 0, rotationY: 0, rotationZ: 0, ease: 'none',
          scrollTrigger: { trigger: el.parentNode, start: 'top 90%', end: 'top 30%', scrub: 1 } });
    } else if (mode === 'rows') {
      gsap.fromTo(el.children,
        { clipPath: 'inset(0% 100% 0% 0%)' },
        { clipPath: 'inset(0% 0% 0% 0%)', duration: 1, stagger: 0.07, clearProps: 'clipPath',
          scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
    } else {
      var media = el.querySelector('img, .ksu-photo');
      var tl = gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
      tl.fromTo(el, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, clearProps: 'clipPath' });
      if (media && !el.hasAttribute('data-ksu-parallax')) tl.fromTo(media, { scale: 1.3 }, { scale: 1, duration: 1.8 }, 0);
    }
  }

  // A photo that drifts inside its frame as the frame crosses the screen. data-ksu-parallax on the frame.
  function parallax(el) {
    var media = el.querySelector('img, .ksu-photo');
    if (!on || !media) return;
    gsap.fromTo(media, { yPercent: -8, scale: 1.2 }, { yPercent: 8, scale: 1.2, ease: 'none',
      scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
  }

  // A soft light that follows the pointer across a card. Class ksu-spot plus data-ksu-spot.
  function spot(el) {
    if (!has) return;
    el.addEventListener('pointermove', function (e) {
      var box = el.getBoundingClientRect();
      gsap.to(el, { '--x': e.clientX - box.left, '--y': e.clientY - box.top, duration: 0.4, ease: 'power2.out', overwrite: true });
    });
  }

  // The booking badge turns as the page scrolls. data-ksu-spin.
  function spin(el) {
    if (!on) return;
    gsap.set(el, { transformOrigin: '50% 50%' });
    gsap.to(el, { rotation: 540, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 1.5 } });
  }

  // The beat ring: a circular waveform. 96 bars stand around a ring; on every beat at 128 BPM they jump and fall back,
  // the ring itself bulges outward under the tall bars, and each beat turns the whole ring a little further round its axis.
  // It cannot hear the music (the player lives in SoundCloud's frame), so it keeps its own tempo: gentle while nothing plays,
  // full strength while a mix is playing, with a harder hit on the first beat of each bar. data-ksu-beat.
  function beat(el) {
    var NS = 'http://www.w3.org/2000/svg', N = 96, R = 110, REST = 6, PUSH = 0.4;
    var circle = el.querySelector('circle'), ring = document.createElementNS(NS, 'path'), lines = [], level = [];
    // A wave around the ring with a whole number of lobes, so the shape closes without a seam.
    function shape(i, seed, lobes) {
      var t = i * 2 * Math.PI / N;
      return Math.min(1, Math.abs(Math.sin(lobes * t + seed) * Math.cos((lobes - 1) * t + seed * 1.7)) + 0.1);
    }
    for (var i = 0; i < N; i++) {
      var l = document.createElementNS(NS, 'line');
      l.setAttribute('x1', 200); l.setAttribute('x2', 200);
      l.setAttribute('transform', 'rotate(' + (i * 360 / N) + ' 200 200)');
      el.appendChild(l);
      lines.push(l);
      level.push({ a: on ? 0 : 60 * shape(i, 1, 3) });
    }
    el.insertBefore(ring, el.firstChild);
    if (circle) circle.style.display = 'none';
    // Draw the ring through one point per bar, pushed out by a share of that bar's height, and stand each bar on it.
    function draw() {
      var d = '';
      for (var i = 0; i < N; i++) {
        var a = level[i].a, r = R + PUSH * a, t = i * 2 * Math.PI / N;
        d += (i ? 'L' : 'M') + (200 + r * Math.sin(t)).toFixed(1) + ' ' + (200 - r * Math.cos(t)).toFixed(1);
        lines[i].setAttribute('y1', (200 - r).toFixed(1));
        lines[i].setAttribute('y2', (200 - r - REST - a).toFixed(1));
      }
      ring.setAttribute('d', d + 'Z');
    }
    draw();
    if (!on) return;
    var period = 60 / 128, n = 0, visible = true, spin = { v: 0 }, turned = 0;
    gsap.set(el, { transformOrigin: '50% 50%' });
    function hit() {
      n++;
      var strength = (api.playing ? 1 : 0.3) * (n % 4 === 1 ? 1.2 : 0.85), seed = Math.random() * 10, lobes = 2 + Math.floor(Math.random() * 4);
      level.forEach(function (v, i) {
        gsap.fromTo(v, { a: 62 * strength * shape(i, seed, lobes) }, { a: 0, duration: period * 0.9, ease: 'power2.in', overwrite: true });
      });
      // Each beat pushes the ring round on its axis: a quick turn that eases out before the next one.
      turned += 14 * strength;
      gsap.to(spin, { v: turned, duration: period * 0.95, ease: 'power3.out', overwrite: true });
    }
    gsap.ticker.add(function () {
      if (!visible) return;
      draw();
      gsap.set(el, { rotation: spin.v });
    });
    (function tick() {
      if (visible) hit();
      gsap.delayedCall(period, tick);
    })();
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; }).observe(el);
    }
  }

  // Film grain that shifts in steps, like frames of film.
  function grain(el) {
    var tex = el.firstElementChild;
    if (!on || !tex) return;
    gsap.timeline({ repeat: -1 })
      .set(tex, { xPercent: -3, yPercent: 2 }, 0.08).set(tex, { xPercent: 2, yPercent: -3 }, 0.16).set(tex, { xPercent: -1, yPercent: 3 }, 0.24)
      .set(tex, { xPercent: 3, yPercent: 1 }, 0.32).set(tex, { xPercent: 0, yPercent: 0 }, 0.4);
  }

  // The opening screen. A small counter runs to 100 while the name KSU fills with coral.
  // On wide screens the hero's own name is the loader: the screen is only the counter and two lines of type over the black hero,
  // so nothing has to lift and the hero simply continues. Elsewhere the screen carries its own name and five shutters lift.
  // Returns { wait: seconds before the hero intro, handoff: true when the hero's name is the loader }.
  function curtain() {
    var el = document.querySelector('[data-ksu-curtain]');
    if (!el) return { wait: 0, handoff: false };
    if (!on) { el.parentNode.removeChild(el); return { wait: 0, handoff: false }; }
    gsap.set(el, { display: 'block' });
    var count = el.querySelector('[data-ksu-count]'), top = el.querySelector('.ksu-curtain__top');
    var name = el.querySelector('.ksu-curtain__name'), fill = el.querySelector('.ksu-curtain__fill'), ghost = el.querySelector('.ksu-curtain__ghost');
    var barsBox = el.querySelector('.ksu-curtain__bars'), bars = el.querySelectorAll('.ksu-curtain__bars i');
    var target = document.querySelector('.ksu-cover__title'), handoff = false;
    if (target && window.innerWidth > 720) {
      var r = target.getBoundingClientRect();
      handoff = r.bottom > 0 && r.top < window.innerHeight;
    }
    var n = { v: 0 };
    var tl = gsap.timeline({ onComplete: function () { el.parentNode.removeChild(el); } });
    if (top) tl.from(top.children, { autoAlpha: 0, y: -12, duration: 0.5, stagger: 0.08 }, 0);
    tl.to(n, { v: 100, duration: 1.4, ease: 'power2.inOut', onUpdate: function () {
      if (count) count.textContent = ('00' + Math.round(n.v)).slice(-3);
    } }, 0);
    if (top) tl.to(top, { autoAlpha: 0, y: -12, duration: 0.4, ease: 'power2.in' }, 1.45);
    if (handoff) {
      if (barsBox) barsBox.parentNode.removeChild(barsBox);
      if (name) name.parentNode.removeChild(name);
      el.style.pointerEvents = 'none';
      return { wait: 0, handoff: true };
    }
    if (name) gsap.set(name, { autoAlpha: 1 });
    // The letters come up a little from below, one after another, as the fill begins.
    if (Split) {
      [ghost, fill].forEach(function (layer) {
        if (layer) tl.from(Split.create(layer, { type: 'chars' }).chars, { yPercent: 35, autoAlpha: 0, duration: 0.8, ease: 'expo.out', stagger: 0.1 }, 0);
      });
    }
    if (fill) tl.fromTo(fill, { clipPath: 'inset(-10% 100% -10% 0%)' }, { clipPath: 'inset(-10% 0% -10% 0%)', duration: 1.4, ease: 'power2.inOut' }, 0);
    if (ghost) tl.set(ghost, { autoAlpha: 0 }, 1.4);
    if (name) tl.to(name, { yPercent: -30, autoAlpha: 0, duration: 0.5, ease: 'power2.in' }, 1.5);
    tl.to(bars, { yPercent: -101, duration: 0.9, ease: 'expo.inOut', stagger: { each: 0.07, from: 'center' } }, 1.55);
    return { wait: 1.8, handoff: false };
  }

  // Size the hero name to the frame's width, capped so it never reaches the info block, and cut the outlined copy to the photograph's edge.
  function coverSize(el) {
    var titles = all('.ksu-cover__title', el), frame = el.querySelector('.ksu-cover__media');
    var info = el.querySelector('.ksu-cover__info'), outline = el.querySelector('.ksu-cover__title--outline');
    if (!titles.length) return;
    var wide = window.innerWidth > 720, lead = titles[wide ? 0 : titles.length - 1];
    titles.forEach(function (t) { t.style.fontSize = '100px'; });
    var w = lead.getBoundingClientRect().width;
    if (!w) return;
    var px = 100 * el.clientWidth / w;
    el.style.minHeight = '';
    if (wide && info) {
      // Keep the name clear of the info block. On a short screen, hold it at 60% of full size and let the hero grow instead.
      var used = info.offsetTop + info.offsetHeight, floor = px * 0.6;
      px = Math.min(px, (el.clientHeight - used) / 0.74);
      if (px < floor) { px = floor; el.style.minHeight = Math.ceil(used + px * 0.74) + 'px'; }
    }
    titles.forEach(function (t) { t.style.fontSize = px.toFixed(2) + 'px'; });
    if (outline) {
      outline.style.clipPath = wide && frame
        ? 'inset(-10% 0px -10% ' + Math.max(0, frame.getBoundingClientRect().left - outline.getBoundingClientRect().left) + 'px)'
        : '';
    }
  }

  // The image-led hero. The name is sized to the frame's width, but never so tall that it reaches the info block above it.
  // On load the name fills and the photograph opens; then the hero holds still while the next section slides up over it.
  function cover(el, opening) {
    var titles = all('.ksu-cover__title', el), frame = el.querySelector('.ksu-cover__media');
    var media = frame && frame.querySelector('img, .ksu-photo'), info = el.querySelector('.ksu-cover__info');
    var outline = el.querySelector('.ksu-cover__title--outline');
    function size() { coverSize(el); }
    size();
    onWidth(function () { size(); if (has) ST.refresh(); });
    if (!on) { shown(); return; }

    opening = opening || { wait: 0, handoff: false };
    var solid = titles[0];
    var intro = gsap.timeline({ delay: opening.wait, onStart: shown });
    if (opening.handoff) {
      // The hero is the loader. Only the name shows: a coral outline that fills from left to right. Then the photograph opens behind it.
      shown();
      var cut = outline ? outline.style.clipPath : '';
      if (frame) gsap.set(frame, { clipPath: 'inset(100% 0% 0% 0%)' });
      if (info) gsap.set(info.children, { autoAlpha: 0, y: 24 });
      if (outline) outline.style.clipPath = 'inset(-10% 0px -10% 0px)';
      // The letters come up a little from below, one after another, as the fill begins.
      if (Split) {
        titles.forEach(function (t) {
          intro.from(Split.create(t, { type: 'chars' }).chars, { yPercent: 35, autoAlpha: 0, duration: 0.8, ease: 'expo.out', stagger: 0.1 }, 0);
        });
      }
      intro.fromTo(solid, { clipPath: 'inset(-10% 100% -10% 0%)' }, { clipPath: 'inset(-10% 0% -10% 0%)', duration: 1.4, ease: 'power2.inOut', clearProps: 'clipPath' }, 0);
      if (outline) intro.call(function () { outline.style.clipPath = cut; }, null, 1.42);
      if (frame) intro.to(frame, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.5, ease: 'expo.inOut', clearProps: 'clipPath' }, 1.3);
      if (media) intro.fromTo(media, { scale: 1.4 }, { scale: 1, duration: 2.4, ease: 'expo.out' }, 1.3);
      if (info) intro.to(info.children, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.08 }, 2.0);
    } else {
      titles.forEach(function (t) {
        var chars = Split ? Split.create(t, { type: 'chars' }).chars : t;
        intro.from(chars, { yPercent: 100, duration: 1.3, stagger: 0.09 }, 0.25);
      });
      if (frame) intro.fromTo(frame, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, clearProps: 'clipPath' }, 0);
      if (media) intro.fromTo(media, { scale: 1.35 }, { scale: 1, duration: 2 }, 0);
      if (info) intro.fromTo(info.children, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.08 }, 0.8);
    }

    if (window.innerWidth < 721) return;
    // The hero holds still without reserving space, so the next section slides up over it. Meanwhile it drifts, swells and dims.
    var pass = gsap.timeline({ scrollTrigger: { trigger: el, start: 'top top', end: '+=100%', pin: true, pinSpacing: false, scrub: 1, anticipatePin: 1 } });
    pass.to(titles, { xPercent: -5, ease: 'none' }, 0);
    if (frame) pass.to(frame, { scale: 1.08, transformOrigin: '100% 50%', ease: 'none' }, 0);
    if (info) pass.to(info, { y: -60, ease: 'none' }, 0);
    pass.to(el, { '--ksu-dim': 0.7, ease: 'none' }, 0);
  }

  // A row of tall photographs. On wide screens it runs by itself in an endless loop; on phones it is a sideways swipe. data-ksu-rail.
  function rail(el) {
    var track = el.querySelector('.ksu-rail__track');
    if (!on || !track) return;
    // Each photograph stays closed until it comes on screen, then opens upward from a mask and settles from a larger scale.
    // The first few open as the rail arrives; the rest open one by one as the scroll brings them in from the right.
    // The mask goes on the photograph, not on its frame: a frame that is fully masked is never reported as on screen.
    var items = Array.prototype.slice.call(track.children);
    var shots = items.map(function (it) { return it.querySelector('img, .ksu-photo--stage') || it; });
    // Not on phones: there the photographs are simply in place, at one fixed size.
    if ('IntersectionObserver' in window && window.innerWidth >= 721) {
      gsap.set(shots, { clipPath: 'inset(100% 0% 0% 0%)', scale: 1.3 });
      var queue = 0;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          io.unobserve(entry.target);
          var shot = shots[items.indexOf(entry.target)], wait = queue * 0.12;
          queue++;
          setTimeout(function () { queue = Math.max(0, queue - 1); }, 400);
          gsap.to(shot, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'expo.out', delay: wait, clearProps: 'clipPath' });
          gsap.to(shot, { scale: 1, duration: 1.8, ease: 'expo.out', delay: wait });
        });
      }, { threshold: 0.1 });
      items.forEach(function (it) { io.observe(it); });
      // A way to show every photograph at once, for debugging.
      api.openRail = function () { gsap.set(shots, { clearProps: 'clipPath,scale' }); };
    }
    // On phones the row stays an ordinary sideways swipe.
    // On wider screens it runs by itself in an endless loop: a second copy of the photographs follows the first,
    // and the row wraps round when the first copy has gone by. It rests while it is off screen.
    // On phones it does not move: the row is an ordinary sideways swipe and the copies are hidden. The width is checked
    // as it runs, so a window that is narrowed (or a phone that is turned) stops and becomes swipeable at once.
    var wide = window.matchMedia('(min-width: 721px)');
    var built = false, running = false, x = 0, speed = 45, visible = true;
    function build() {
      built = true;
      items.forEach(function (it) {
        var copy = it.cloneNode(true);
        copy.classList.add('ksu-rail__copy');
        copy.setAttribute('aria-hidden', 'true');
        var img = copy.querySelector('img');
        if (img) { img.alt = ''; gsap.set(img, { clearProps: 'clipPath,scale' }); }
        track.appendChild(copy);
      });
    }
    gsap.ticker.add(function (time, delta) {
      if (!wide.matches) {
        if (running) { running = false; x = 0; gsap.set(track, { clearProps: 'transform' }); el.style.overflow = ''; }
        return;
      }
      if (!built) build();
      if (!running) { running = true; el.scrollLeft = 0; el.style.overflow = 'hidden'; }
      if (!visible) return;
      var half = track.children[items.length].offsetLeft - items[0].offsetLeft;
      if (!half) return;
      x -= speed * Math.min(delta, 100) / 1000;
      if (x <= -half) x += half;
      gsap.set(track, { x: x });
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; }).observe(el);
    }
  }

  // The fixed booking button. It appears once the hero has gone by, leaves when the footer arrives, switches to its inverse colours while it sits over the
  // accent section, and its arrow slips out and back every few seconds. data-ksu-float.
  function float(el) {
    var grounds = all('.ksu-accent');
    function tone() {
      var b = el.getBoundingClientRect(), mid = b.top + b.height / 2;
      var over = grounds.some(function (g) { var r = g.getBoundingClientRect(); return r.top <= mid && r.bottom >= mid; });
      el.classList.toggle('is-inverse', over);
    }
    tone();
    window.addEventListener('scroll', tone, { passive: true });
    if (!on) return;
    ST.create({ start: 0, end: 'max', onUpdate: tone });
    // Shown between the end of the hero and the start of the element named in the attribute (the footer).
    var past = false, done = false, shownNow = false;
    function show() {
      var want = past && !done;
      if (want === shownNow) return;
      shownNow = want;
      if (want) gsap.to(el, { yPercent: 0, autoAlpha: 1, duration: 0.6, overwrite: true });
      else gsap.to(el, { yPercent: 140, autoAlpha: 0, duration: 0.3, ease: 'power2.in', overwrite: true });
    }
    gsap.set(el, { yPercent: 140, autoAlpha: 0 });
    ST.create({
      start: function () { return window.innerHeight * 0.9; },
      onEnter: function () { past = true; show(); },
      onLeaveBack: function () { past = false; show(); }
    });
    var stop = el.getAttribute('data-ksu-float') && document.querySelector(el.getAttribute('data-ksu-float'));
    if (stop) {
      ST.create({
        trigger: stop, start: 'top bottom',
        onEnter: function () { done = true; show(); },
        onLeaveBack: function () { done = false; show(); }
      });
    }
    var arrow = el.querySelector('.ksu-cta__arrow');
    if (arrow) {
      gsap.timeline({ repeat: -1, repeatDelay: 4, delay: 3 })
        .to(arrow, { x: 14, y: -14, autoAlpha: 0, duration: 0.3, ease: 'power2.in' })
        .set(arrow, { x: -14, y: 14 })
        .to(arrow, { x: 0, y: 0, autoAlpha: 1, duration: 0.45, ease: 'power3.out' });
    }
  }

  function hero(el, wait) {
    if (!on) { shown(); return; }
    var title = el.querySelector('.ksu-hero-title');
    var panels = el.querySelector('.ksu-hero-panels');
    var card = el.querySelector('.ksu-hero-card');
    var media = panels && panels.querySelector('img, .ksu-photo');
    var chars = title && Split ? Split.create(title, { type: 'chars' }).chars : title;

    var intro = gsap.timeline({ onStart: shown, delay: wait || 0 });
    if (title) intro.from(chars, { yPercent: 100, duration: 1.3, stagger: 0.09 }, 0.1);
    if (panels) {
      intro.fromTo(panels.children,
        { yPercent: 30, clipPath: 'inset(100% 0% 0% 0%)' },
        { yPercent: 0, clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, stagger: 0.1, clearProps: 'clipPath' }, 0.45);
    }
    if (media) intro.from(media, { scale: 1.35, duration: 1.9 }, 0.45);
    if (card) intro.from(card.children, { autoAlpha: 0, y: 24, duration: 0.9, stagger: 0.08 }, 0.95);

    var pass = gsap.timeline({
      scrollTrigger: { trigger: el, start: 'top top', end: '+=90%', pin: true, scrub: 1, anticipatePin: 1, invalidateOnRefresh: true }
    });
    if (title) pass.to(title, { yPercent: -18, ease: 'none' }, 0);
    if (panels) pass.to(panels, { y: function () { return title ? -title.offsetHeight * 0.5 : 0; }, ease: 'none' }, 0);
  }

  // A fixed nav bar that slides away on scroll down and returns on scroll up.
  function nav(el, wait) {
    if (!on) return;
    gsap.from(el, { autoAlpha: 0, y: -16, duration: 0.8, delay: wait || 0.1 });
    var slide = gsap.fromTo(el, { yPercent: 0 }, { yPercent: -100, paused: true, duration: 0.35, ease: 'power2.out' });
    ST.create({
      start: 'top -120',
      onUpdate: function (self) { if (self.direction === 1) slide.play(); else slide.reverse(); },
      onLeaveBack: function () { slide.reverse(); }
    });
  }

  // Keep a vertical title in view while its section scrolls past. Put the attribute on a wrapper around the title.
  function pin(el) {
    if (!on || window.innerWidth < 721) return;
    var section = el.closest('[data-ksu-section]') || el.parentNode;
    ST.create({
      trigger: section, start: 'top 14%', pin: el, pinSpacing: false, invalidateOnRefresh: true,
      end: function () { return '+=' + Math.max(0, section.offsetHeight - el.offsetHeight); }
    });
  }

  // A band of large type that travels sideways as the page scrolls. The track holds its content twice.
  function marquee(el) {
    var track = el.firstElementChild;
    if (!on || !track) return;
    // The items are written twice, so the band wraps round when the first set has gone by. It rests while it is off screen.
    var n = track.children.length / 2;
    if (n < 1 || n % 1) return;
    var back = el.getAttribute('data-ksu-marquee') === 'reverse';
    var x = 0, speed = 80, visible = true;
    gsap.ticker.add(function (time, delta) {
      if (!visible) return;
      var half = track.children[n].offsetLeft - track.children[0].offsetLeft;
      if (!half) return;
      x += speed * Math.min(delta, 100) / 1000;
      if (x >= half) x -= half;
      gsap.set(track, { x: back ? x - half : -x });
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; }).observe(el);
    }
  }

  // The lit layer of the ring field: one SVG circle per ring, each glowing and fading on its own clock.
  function rings(el) {
    var NS = 'http://www.w3.org/2000/svg';
    var cs = getComputedStyle(el);
    var pitch = parseFloat(cs.getPropertyValue('--ring-pitch')) || 262;
    var r = parseFloat(cs.getPropertyValue('--ring-radius')) || 96;
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'ksu-rings__lit');
    svg.setAttribute('aria-hidden', 'true');
    el.insertBefore(svg, el.firstChild);
    function build() {
      if (has) gsap.killTweensOf(svg.childNodes);
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var w = el.clientWidth, h = el.clientHeight;
      svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      for (var y = 0; y <= h + r; y += pitch) {
        for (var x = 0; x <= w + r; x += pitch) {
          var c = document.createElementNS(NS, 'circle');
          c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', r);
          svg.appendChild(c);
          if (on) {
            gsap.to(c, {
              opacity: 1, duration: gsap.utils.random(1.5, 3), ease: 'sine.inOut', yoyo: true, repeat: -1,
              repeatDelay: gsap.utils.random(2, 9), delay: gsap.utils.random(0, 8)
            });
          }
        }
      }
    }
    build();
    var timer;
    window.addEventListener('resize', function () { clearTimeout(timer); timer = setTimeout(build, 200); });
  }

  // The mix player. Buttons with data-ksu-track (a SoundCloud track URL) play through one SoundCloud widget,
  // created on the first press; [data-ksu-player] is the fixed bar that shows what is playing.
  function player() {
    var buttons = all('[data-ksu-track]');
    var bar = document.querySelector('[data-ksu-player]');
    if (!buttons.length) return;
    var widget = null, current = null, duration = 0;
    var q = function (sel) { return bar ? bar.querySelector(sel) : null; };
    var title = q('.ksu-player__title'), time = q('.ksu-player__time'), fill = q('.ksu-player__fill');
    var track = q('.ksu-player__progress'), toggle = q('[data-ksu-player-toggle]'), link = q('[data-ksu-player-link]');
    var bars = track ? all('.ksu-wave rect', track) : [];
    var eq = bar && on ? gsap.to(all('.ksu-eq rect', bar), { scaleY: 0.25, duration: 0.3, ease: 'sine.inOut', yoyo: true, repeat: -1, stagger: 0.12, paused: true }) : null;

    // Two markers on the progress bar: the handle, which shows where the mix is now, and the seek marker,
    // which follows the pointer and shows where a press would jump to, with the time at that point.
    var head = null, mark = null, nowEl = null, totalEl = null;
    if (track) {
      head = document.createElement('span'); head.className = 'ksu-player__playhead';
      mark = document.createElement('span'); mark.className = 'ksu-player__seek'; mark.setAttribute('data-time', '');
      track.appendChild(head); track.appendChild(mark);
    }
    function clock(ms) {
      var s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), r = s % 60;
      return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (r < 10 ? '0' : '') + r;
    }
    function paint(rel, pos) {
      if (fill) { if (has) gsap.set(fill, { scaleX: rel }); else fill.style.transform = 'scaleX(' + rel + ')'; }
      if (time) {
        // Elapsed time and total length are separate, so narrow screens can show the elapsed time alone.
        if (!nowEl) {
          time.textContent = '';
          nowEl = document.createElement('span'); nowEl.className = 'ksu-player__now';
          totalEl = document.createElement('span'); totalEl.className = 'ksu-player__total';
          time.appendChild(nowEl); time.appendChild(totalEl);
        }
        nowEl.textContent = clock(pos);
        totalEl.textContent = ' / ' + (duration ? clock(duration) : '-:--');
      }
      if (track) track.setAttribute('aria-valuenow', Math.round(rel * 100));
      bars.forEach(function (b, n) { b.classList.toggle('is-on', n / bars.length < rel); });
      if (head) head.style.left = (rel * 100).toFixed(2) + '%';
    }
    function state(playing) {
      buttons.forEach(function (b) {
        var onNow = b === current && playing;
        b.setAttribute('aria-pressed', onNow ? 'true' : 'false');
        var row = b.closest('.ksu-mix');
        if (row) row.classList.toggle('is-playing', onNow);
      });
      api.playing = playing;
      if (toggle) toggle.setAttribute('aria-pressed', playing ? 'true' : 'false');
      if (eq) { if (playing) eq.play(); else eq.pause(); }
    }
    // Loading: from the press until SoundCloud actually starts the mix, the progress bar pulses. Nothing else changes.
    var shimmer = null, closeBtn = q('[data-ksu-player-close]');
    function loading(btn) {
      if (shimmer) { shimmer.kill(); shimmer = null; if (has && track) gsap.set(track, { clearProps: 'opacity' }); }
      if (!btn) return;
      if (on && track) shimmer = gsap.fromTo(track, { opacity: 1 }, { opacity: 0.35, duration: 0.5, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    }
    // Tell the page how tall the bar is, so anything fixed above it (the booking button) can keep clear of it.
    var closing = false;
    function room() {
      var h = bar && !bar.hidden && !closing ? bar.offsetHeight : 0;
      document.documentElement.style.setProperty('--ksu-player-h', h + 'px');
    }
    onWidth(room);
    function close() {
      wanted = false;
      if (widget) widget.pause();
      loading(null);
      state(false);
      if (!bar || bar.hidden) return;
      closing = true;
      room();
      if (on) gsap.to(bar, { yPercent: 100, duration: 0.4, ease: 'power2.in', onComplete: function () { bar.hidden = true; closing = false; gsap.set(bar, { clearProps: 'transform' }); } });
      else { bar.hidden = true; closing = false; }
    }
    function show(btn) {
      var row = btn.closest('.ksu-mix'), name = row && row.querySelector('.ksu-mix__title');
      if (title) title.textContent = name ? name.textContent : '';
      if (link) link.href = btn.getAttribute('data-ksu-track');
      if (bar) {
        // Cancel a close that is still sliding the bar away, then bring it in.
        var wasHidden = bar.hidden || closing;
        if (has) gsap.killTweensOf(bar);
        closing = false;
        bar.hidden = false;
        if (wasHidden && on) gsap.fromTo(bar, { yPercent: 100 }, { yPercent: 0, duration: 0.6 });
        else if (has) gsap.set(bar, { yPercent: 0 });
        room();
      }
      if (btn !== current || !duration) paint(0, 0);
    }
    function fail() {
      loading(null);
      state(false);
      if (title) title.textContent = 'Playback is unavailable here. Open the mix on SoundCloud.';
    }
    function measure() { widget.getDuration(function (d) { duration = d; }); }
    // Switching mixes: the player is told to load the new one and then explicitly to play it, and is checked twice afterwards.
    // If a press arrives while the player is still starting up or loading, the latest press wins.
    var frame = null, ready = false, pending = null, loaded = null, wanted = false, checks = [];
    // While one mix is being swapped for another, the old one keeps reporting its position for a moment.
    // Those reports are ignored so the bar stays at the start until the new mix actually plays.
    var switching = false;
    function watch(url) {
      checks.forEach(clearTimeout);
      checks = [1500, 4000].map(function (ms) {
        return setTimeout(function () {
          if (!wanted || loaded !== url) return;
          widget.isPaused(function (paused) { if (paused && wanted && loaded === url) widget.play(); });
        }, ms);
      });
    }
    function load(url) {
      loaded = url;
      widget.load(url, { auto_play: true, show_artwork: false, callback: function () {
        if (pending && pending !== url) { var next = pending; pending = null; load(next); return; }
        pending = null;
        measure();
        widget.play();
        watch(url);
      } });
    }
    function bind() {
      var E = window.SC.Widget.Events;
      widget.bind(E.READY, function () {
        if (ready) return;
        ready = true;
        if (pending && pending !== loaded) { var next = pending; pending = null; load(next); return; }
        pending = null;
        measure();
        if (wanted) { widget.play(); watch(loaded); }
      });
      widget.bind(E.PLAY, function () { switching = false; measure(); loading(null); state(true); });
      widget.bind(E.PAUSE, function () { state(false); });
      widget.bind(E.PLAY_PROGRESS, function (e) { if (!switching) paint(e.relativePosition, e.currentPosition); });
      widget.bind(E.SEEK, function (e) { if (!switching) paint(e.relativePosition, e.currentPosition); });
      widget.bind(E.FINISH, function () {
        state(false);
        var next = buttons[buttons.indexOf(current) + 1];
        if (next) start(next);
      });
      widget.bind(E.ERROR, fail);
    }
    // Build SoundCloud's player ahead of time, silent, with the first mix loaded. Phones only allow sound that starts
    // inside the press itself; if the player were built on the first press, that press would be spent before it could play.
    function build(url) {
      if (frame) return;
      loaded = url;
      frame = document.createElement('iframe');
      frame.className = 'ksu-player__frame';
      frame.allow = 'autoplay';
      frame.title = 'SoundCloud player';
      frame.tabIndex = -1;
      frame.src = 'https://w.soundcloud.com/player/?url=' + encodeURIComponent(url) + '&auto_play=false&show_artwork=false&visual=false';
      document.body.appendChild(frame);
      var script = document.createElement('script');
      script.src = 'https://w.soundcloud.com/player/api.js';
      script.onload = function () { widget = window.SC.Widget(frame); bind(); };
      script.onerror = function () { if (wanted) fail(); };
      document.head.appendChild(script);
    }
    function prepare() { build(buttons[0].getAttribute('data-ksu-track')); }
    function start(btn) {
      var url = btn.getAttribute('data-ksu-track');
      stopVideos();
      if (btn === current && widget && ready && loaded === url && !pending) {
        if (bar && bar.hidden) show(btn);
        widget.isPaused(function (paused) { wanted = paused; widget.toggle(); });
        return;
      }
      current = btn; duration = 0; wanted = true;
      state(false);
      show(btn);
      loading(btn);
      if (widget && ready) {
        pending = null;
        // Both calls are made inside the press: play at once if this mix is the one already loaded, otherwise load it.
        if (loaded === url) { measure(); widget.play(); watch(url); }
        else { switching = true; paint(0, 0); load(url); }
        return;
      }
      pending = url;
      build(url);
    }
    // Jump, and move the playhead at once rather than waiting for the player to report back.
    function seek(rel) {
      if (!widget || !duration || switching) return;
      rel = Math.max(0, Math.min(1, rel));
      widget.seekTo(rel * duration);
      paint(rel, rel * duration);
    }

    api.pauseAudio = function () { wanted = false; if (widget) widget.pause(); };
    buttons.forEach(function (b) { b.addEventListener('click', function () { start(b); }); });
    // Get the player ready as soon as the visitor touches the page or the mixes come near the screen.
    ['pointerdown', 'touchstart', 'keydown'].forEach(function (type) {
      window.addEventListener(type, prepare, { once: true, passive: true });
    });
    if ('IntersectionObserver' in window) {
      var near = new IntersectionObserver(function (entries) {
        if (entries.some(function (en) { return en.isIntersecting; })) { near.disconnect(); prepare(); }
      }, { rootMargin: '800px 0px' });
      near.observe(buttons[0]);
    } else prepare();
    if (toggle) toggle.addEventListener('click', function () {
      if (widget) widget.isPaused(function (paused) { wanted = paused; widget.toggle(); });
    });
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (track) {
      // Press and release to jump, or press, drag along the bar and release where you want to land.
      var dragging = false;
      function at(e) {
        var box = track.getBoundingClientRect();
        return Math.max(0, Math.min(1, (e.clientX - box.left) / box.width));
      }
      function point(e) {
        var rel = at(e);
        track.classList.add('is-hover');
        mark.style.left = (rel * 100).toFixed(2) + '%';
        mark.setAttribute('data-time', duration ? clock(rel * duration) : '');
        bars.forEach(function (b, n) { b.classList.toggle('is-hover', n / bars.length < rel); });
      }
      function clear() {
        track.classList.remove('is-hover');
        bars.forEach(function (b) { b.classList.remove('is-hover'); });
      }
      track.addEventListener('pointerdown', function (e) {
        dragging = true;
        if (track.setPointerCapture) track.setPointerCapture(e.pointerId);
        point(e);
        e.preventDefault();
      });
      track.addEventListener('pointermove', point);
      track.addEventListener('pointerup', function (e) {
        if (!dragging) return;
        dragging = false;
        seek(at(e));
        if (e.pointerType !== 'mouse') clear();
      });
      track.addEventListener('pointercancel', function () { dragging = false; clear(); });
      track.addEventListener('pointerleave', function () { if (!dragging) clear(); });
      track.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        var now = Number(track.getAttribute('aria-valuenow')) / 100;
        seek(now + (e.key === 'ArrowRight' ? 0.02 : -0.02));
      });
    }
  }

  // Silent video loops inside photo frames. They play only while on screen, and not at all under reduced motion.
  function loops() {
    all('video.ksu-photo').forEach(function (v) {
      v.muted = true;
      if (reduce) { v.removeAttribute('autoplay'); v.pause(); return; }
      if (!('IntersectionObserver' in window)) return;
      new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        else v.pause();
      }, { threshold: 0.1 }).observe(v.parentNode);
    });
  }

  // Make the whole of a list row act as its control: pressing the title or the empty space plays the mix,
  // or opens the row's link when it has no play button. Presses on a link or button inside the row keep their own meaning.
  function rowActions() {
    all('.ksu-mix').forEach(function (row) {
      var control = row.querySelector('.ksu-play') || row.querySelector('a.ksu-cta');
      if (!control) return;
      row.classList.add('ksu-mix--action');
      row.addEventListener('click', function (e) {
        if (e.target.closest('a, button')) return;
        control.click();
      });
    });
  }

  // Wire up everything in the document by attribute. Call once, after fonts have loaded (KSU.ready does that).
  function init(opts) {
    opts = opts || {};
    all('[data-ksu-fit]').forEach(fit);
    if (opts.smooth !== false) smooth(opts.smoother);
    all('[data-ksu-video]').forEach(video);
    all('[data-ksu-rings]').forEach(rings);
    all('[data-ksu-cover]').forEach(coverSize);
    var opening = curtain();
    all('[data-ksu-hero]').forEach(function (el) { hero(el, opening.wait); });
    all('[data-ksu-cover]').forEach(function (el) { cover(el, opening); });
    all('[data-ksu-nav]').forEach(function (el) { nav(el, opening.handoff ? 2.1 : opening.wait + 0.3); });
    all('[data-ksu-rail]').forEach(rail);
    all('[data-ksu-float]').forEach(float);
    all('[data-ksu-parallax]').forEach(parallax);
    all('[data-ksu-spot]').forEach(spot);
    all('[data-ksu-grain]').forEach(grain);
    all('[data-ksu-spin]').forEach(spin);
    all('[data-ksu-beat]').forEach(beat);
    all('[data-ksu-reveal]').forEach(reveal);
    all('[data-ksu-enter]').forEach(enter);
    all('[data-ksu-pin]').forEach(pin);
    all('[data-ksu-marquee]').forEach(marquee);
    player();
    rowActions();
    loops();
    if (!all('[data-ksu-hero], [data-ksu-cover]').length) shown();
    if (has) ST.refresh();
  }

  function ready(opts) {
    var go = function () { init(opts); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(go, go); else go();
  }

  api.init = init; api.ready = ready; api.smooth = smooth; api.reveal = reveal; api.enter = enter;
  api.cover = cover; api.fit = fit; api.video = video; api.parallax = parallax; api.spot = spot; api.player = player; api.hero = hero; api.nav = nav; api.pin = pin; api.marquee = marquee; api.rings = rings;
  window.KSU = api;
})();
