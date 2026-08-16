/* Precept documentation — theme toggle, mobile nav, search, scroll spy. No dependencies. */
(function () {
  'use strict';

  /* ---------- theme ---------- */

  var root = document.documentElement;

  document.querySelector('.theme').addEventListener('click', function () {
    var dark = root.dataset.theme
      ? root.dataset.theme === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;

    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('precept-theme', root.dataset.theme); } catch (e) { /* private mode */ }
  });

  /* ---------- mobile nav ---------- */

  var menu = document.querySelector('.menu');
  var scrim = document.querySelector('.scrim');

  function closeNav() {
    document.body.classList.remove('nav-open');
    menu.setAttribute('aria-expanded', 'false');
    scrim.hidden = true;
  }

  menu.addEventListener('click', function () {
    var open = document.body.classList.toggle('nav-open');
    menu.setAttribute('aria-expanded', String(open));
    scrim.hidden = !open;
  });

  scrim.addEventListener('click', closeNav);

  /* ---------- on this page ---------- */

  var tocLinks = Array.prototype.slice.call(document.querySelectorAll('.toc a'));

  if (tocLinks.length && 'IntersectionObserver' in window) {
    var headings = tocLinks
      .map(function (a) { return document.getElementById(a.hash.slice(1)); })
      .filter(Boolean);

    var seen = new Set();

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { seen.add(entry.target.id); } else { seen.delete(entry.target.id); }
      });

      var current = headings.filter(function (h) { return seen.has(h.id); })[0];
      if (!current) { return; }

      tocLinks.forEach(function (a) {
        a.classList.toggle('active', a.hash === '#' + current.id);
      });
    }, { rootMargin: '-70px 0px -70% 0px' });

    headings.forEach(function (h) { observer.observe(h); });
  }

  /* ---------- search ---------- */

  var dialog = document.querySelector('dialog.search');
  var opener = document.querySelector('.search-open');
  var input = dialog.querySelector('input');
  var results = dialog.querySelector('.results');
  var empty = dialog.querySelector('.search-empty');
  var index = null;
  var selected = 0;

  function load() {
    if (index) { return Promise.resolve(index); }

    return fetch('search-index.json')
      .then(function (r) { return r.json(); })
      .then(function (data) { index = data; return index; })
      .catch(function () {
        // file:// blocks the fetch. The site is meant to be served, so say so rather than fail mute.
        index = [];
        empty.textContent = 'Search needs the site to be served over http, not opened as a file.';
        return index;
      });
  }

  function open() {
    load().then(function () {
      if (!dialog.open) { dialog.showModal(); }
      input.select();
    });
  }

  opener.addEventListener('click', open);

  document.addEventListener('keydown', function (e) {
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);

    if (!dialog.open && !typing && (e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey)))) {
      e.preventDefault();
      open();
    }
  });

  dialog.addEventListener('click', function (e) {
    if (e.target === dialog) { dialog.close(); }
  });

  function escape(text) {
    return text.replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function excerpt(text, query) {
    var at = text.toLowerCase().indexOf(query);
    if (at < 0) { return escape(text.slice(0, 110)); }

    var from = Math.max(0, at - 40);
    var slice = (from ? '…' : '') + text.slice(from, from + 130);
    var start = slice.toLowerCase().indexOf(query);

    return escape(slice.slice(0, start))
      + '<mark>' + escape(slice.slice(start, start + query.length)) + '</mark>'
      + escape(slice.slice(start + query.length));
  }

  function search(query) {
    var found = [];

    index.forEach(function (page) {
      var title = page.title.toLowerCase();
      var score = 0;

      if (title === query) { score = 100; }
      else if (title.indexOf(query) === 0) { score = 60; }
      else if (title.indexOf(query) >= 0) { score = 40; }

      var heading = (page.headings || []).filter(function (h) {
        return h.text.toLowerCase().indexOf(query) >= 0;
      })[0];

      if (heading) { score += 30; }

      // How often a page says the word is the only signal left once several pages say it at all,
      // and it is a good one: the page about retries mentions retries far more than the page that
      // links to it.
      var body = page.text.toLowerCase();
      var hits = 0;
      for (var at = body.indexOf(query); at >= 0; at = body.indexOf(query, at + query.length)) {
        hits++;
      }

      score += Math.min(hits, 12) * 2;

      if (!score) { return; }

      found.push({
        url: heading ? page.url + '#' + heading.id : page.url,
        title: heading ? page.title + ' › ' + heading.text : page.title,
        group: page.group,
        text: page.text,
        score: score,
      });
    });

    return found.sort(function (a, b) { return b.score - a.score; }).slice(0, 12);
  }

  function highlight() {
    Array.prototype.forEach.call(results.children, function (li, i) {
      li.classList.toggle('selected', i === selected);
    });
  }

  input.addEventListener('input', function () {
    var query = input.value.trim().toLowerCase();
    results.innerHTML = '';
    selected = 0;

    if (query.length < 2) {
      empty.hidden = true;
      return;
    }

    var found = search(query);
    empty.hidden = found.length > 0;

    found.forEach(function (hit) {
      var li = document.createElement('li');
      li.innerHTML =
        '<a href="' + hit.url + '">'
        + '<span class="r-group">' + escape(hit.group) + '</span>'
        + '<span class="r-title">' + escape(hit.title) + '</span>'
        + '<span class="r-text">' + excerpt(hit.text, query) + '</span>'
        + '</a>';
      results.appendChild(li);
    });

    highlight();
  });

  dialog.addEventListener('keydown', function (e) {
    var count = results.children.length;
    if (!count) { return; }

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      selected = (selected + (e.key === 'ArrowDown' ? 1 : count - 1)) % count;
      highlight();
      results.children[selected].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      results.children[selected].querySelector('a').click();
    }
  });
})();
