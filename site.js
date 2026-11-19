/* Hedge Espresso — shared behaviour for index.html and gallery.html.
   Every block is guarded, so it is safe on a page that lacks that piece. */
(function(){
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── DEMO PHOTOS ────────────────────────────────────────────────────
     Off. The site now uses Hedge Espresso's own photo files, which sit
     in the same folder as the pages. If a file is ever missing, its
     slot shows a tidy labelled placeholder rather than a broken image. */
  var USE_DEMO_PHOTOS = false;
  /* ─────────────────────────────────────────────────────────────────── */

  /* --- year --- */
  var yr = document.getElementById('yr');
  if (yr) yr.textContent = new Date().getFullYear();

  /* --- a photo that isn't there yet -----------------------------------
     First try the demo copy (while USE_DEMO_PHOTOS is on), and only
     if that fails too show a tidy labelled slot rather than a broken
     image. Catches failures from here on, plus a sweep for any image
     that had already failed before this file ran.                      */
  function handleMissing(img){
    var demo = img.getAttribute('data-demo');
    if (USE_DEMO_PHOTOS && demo && img.getAttribute('data-fellback') !== '1') {
      img.setAttribute('data-fellback', '1');
      img.src = demo;
      return;
    }
    var holder = img.closest('.shot, .frame');
    if (holder) holder.classList.add('noimg');
  }
  document.addEventListener('error', function(e){
    if (e.target && e.target.tagName === 'IMG') handleMissing(e.target);
  }, true);
  document.querySelectorAll('.shot img, .frame img').forEach(function(img){
    if (img.complete && img.naturalWidth === 0) handleMissing(img);
  });

  /* --- live open / closed status, always in Brisbane time --------------
     Hours are 6:00–14:00 every day. Computed against Australia/Brisbane
     so a visitor in another timezone still sees the truth.             */
  function brisbaneNow(){
    try {
      var parts = new Intl.DateTimeFormat('en-AU', {
        timeZone:'Australia/Brisbane', hour:'2-digit', minute:'2-digit',
        weekday:'short', hour12:false
      }).formatToParts(new Date());
      var out = {};
      parts.forEach(function(p){ out[p.type] = p.value; });
      var days = {Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
      return {
        mins: parseInt(out.hour,10) * 60 + parseInt(out.minute,10),
        day: days[out.weekday] != null ? days[out.weekday] : new Date().getDay()
      };
    } catch(e) {
      var d = new Date();
      return {mins: d.getHours()*60 + d.getMinutes(), day: d.getDay()};
    }
  }

  var OPEN = 6*60, CLOSE = 14*60;
  var now = brisbaneNow();
  var wrapEl = document.getElementById('livestatus');
  var textEl = document.getElementById('statustext');

  if (wrapEl && textEl) {
    if (now.mins >= OPEN && now.mins < CLOSE) {
      textEl.textContent = 'We’re open now — till 2pm';
      wrapEl.classList.remove('shut');
    } else {
      wrapEl.classList.add('shut');
      textEl.textContent = now.mins < OPEN
        ? 'Closed — we open at 6am'
        : 'Closed — we open again at 6am';
    }
  }

  /* highlight today's row in the hours table */
  var todayRow = document.querySelector('#hours tr[data-day="' + now.day + '"]');
  if (todayRow) todayRow.classList.add('today');

  /* --- nav shadow on scroll --- */
  var nav = document.getElementById('nav');
  function onScroll(){ nav.classList.toggle('stuck', window.scrollY > 40); }
  onScroll();
  window.addEventListener('scroll', onScroll, {passive:true});

  /* --- fade and rise --- */
  var revealEls = document.querySelectorAll('.reveal');
  if (reduce || !('IntersectionObserver' in window)) {
    revealEls.forEach(function(el){ el.classList.add('in'); });
  } else {
    var ro = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if (e.isIntersecting) { e.target.classList.add('in'); ro.unobserve(e.target); }
      });
    }, {rootMargin:'0px 0px -12% 0px', threshold:0.1});
    revealEls.forEach(function(el){ ro.observe(el); });
  }

  /* --- count up --- */
  var nums = document.querySelectorAll('[data-count]');
  function countUp(el){
    var target   = parseFloat(el.getAttribute('data-count'));
    var decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
    var suffix   = el.getAttribute('data-suffix') || '';
    var dur = 1400, start = null;
    function step(ts){
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = (target * eased).toFixed(decimals) + suffix;
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = target.toFixed(decimals) + suffix;
    }
    requestAnimationFrame(step);
  }
  if (!reduce && 'IntersectionObserver' in window) {
    var no = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if (e.isIntersecting) { countUp(e.target); no.unobserve(e.target); }
      });
    }, {threshold:0.5});
    nums.forEach(function(el){ no.observe(el); });
  }


  /* --- menu page: highlight the section you're looking at in the jump bar --- */
  var catbar = document.getElementById('catbar');
  if (catbar && 'IntersectionObserver' in window) {
    var links = {};
    catbar.querySelectorAll('a[href^="#"]').forEach(function(a){
      links[a.getAttribute('href').slice(1)] = a;
    });
    var sections = Object.keys(links)
      .map(function(id){ return document.getElementById(id); })
      .filter(Boolean);

    if (sections.length) {
      var seen = {};
      var co = new IntersectionObserver(function(entries){
        entries.forEach(function(e){ seen[e.target.id] = e.intersectionRatio; });
        /* whichever section owns the most of the viewport wins */
        var best = null, bestRatio = 0;
        Object.keys(seen).forEach(function(id){
          if (seen[id] > bestRatio) { bestRatio = seen[id]; best = id; }
        });
        Object.keys(links).forEach(function(id){
          links[id].classList.toggle('active', id === best && bestRatio > 0);
        });
      }, {threshold: [0, 0.1, 0.25, 0.5, 0.75, 1], rootMargin: '-25% 0px -45% 0px'});
      sections.forEach(function(s){ co.observe(s); });
    }
  }

  /* --- shared async form submit --- */
  function wire(form, onDone, noteEl, invalidMsg, failMsg){
    if (!form) return;
    form.addEventListener('submit', function(ev){
      ev.preventDefault();

      if (!form.checkValidity()) {
        if (noteEl) { noteEl.textContent = invalidMsg; noteEl.style.color = '#ffd2c4'; }
        var bad = form.querySelector(':invalid');
        if (bad) bad.focus();
        return;
      }

      var btn = form.querySelector('button[type="submit"]');
      var original = btn.innerHTML;
      btn.disabled = true;
      btn.textContent = 'Sending…';

      fetch(form.action, {
        method:'POST',
        body:new FormData(form),
        headers:{'Accept':'application/json'}
      })
      .then(function(res){
        if (!res.ok) throw new Error('bad response');
        onDone();
      })
      .catch(function(){
        btn.disabled = false;
        btn.innerHTML = original;
        if (noteEl) { noteEl.textContent = failMsg; noteEl.style.color = '#ffd2c4'; }
      });
    });
  }

  /* catering form */
  var bForm  = document.getElementById('booking-form');
  var thanks = document.getElementById('thanks');
  wire(bForm, function(){
    bForm.classList.add('sent');
    thanks.classList.add('on');
    thanks.scrollIntoView({behavior: reduce ? 'auto' : 'smooth', block:'center'});
  },
  document.getElementById('form-note'),
  'Just need your name and a phone number so we can call you back.',
  'That didn’t send, sorry. Ring us on 07 3274 3018 and we’ll sort it out.');

  /* newsletter */
  var sForm = document.getElementById('signup-form');
  var sDone = document.getElementById('signup-done');
  wire(sForm, function(){
    sForm.classList.add('gone');
    sDone.classList.add('on');
  },
  document.getElementById('signup-note'),
  'Pop in a valid email address and we’ll add you.',
  'That didn’t go through, sorry. Try again in a moment.');
})();
