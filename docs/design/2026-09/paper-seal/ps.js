/* The reader's stamp. Same storage contract as the live site (lp.reader.v3) —
 * only the instrument changes: a 77×25 dropdown becomes the largest control on the page. */
(function () {
  var KEY = 'lp.reader.v3';
  var LABEL = { want: '관심 있는 책', opened: '펼쳐본 책', have: '구매한 책', read: '읽은 책' };
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || { v: 3, state: {} }; } catch (e) { return { v: 3, state: {} }; } }
  function save(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {} }

  function paint(id) {
    var p = load(), s = (p.state[id] && p.state[id].s) || '';
    var marks = document.querySelectorAll('.mark[data-work="' + id + '"]');
    for (var i = 0; i < marks.length; i++) {
      var m = marks[i];
      m.setAttribute('data-state', s);
      var main = m.querySelector('.mark-main');
      main.querySelector('.mark-label').textContent = s ? LABEL[s] : LABEL.want;
      main.setAttribute('aria-pressed', s ? 'true' : 'false');
      var bs = m.querySelectorAll('.mark-ladder [data-set]');
      for (var j = 0; j < bs.length; j++) bs[j].setAttribute('aria-pressed', bs[j].getAttribute('data-set') === s && s ? 'true' : 'false');
    }
    var page = document.querySelector('[data-stamp-for="' + id + '"]');
    if (page) {
      page.classList.toggle('has-mark', !!s);
      var st = page.querySelector('.stamped'); if (st && s) st.textContent = LABEL[s];
    }
  }
  function set(id, s) {
    var p = load();
    if (s) p.state[id] = { s: s, at: Date.now() }; else delete p.state[id];
    save(p); paint(id);
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.mark [data-set]');
    if (!b) return;
    var m = b.closest('.mark'), id = m.getAttribute('data-work'), cur = m.getAttribute('data-state') || '';
    if (b.classList.contains('mark-main')) {
      if (!cur) { set(id, 'want'); if (!m.classList.contains('big')) m.classList.add('open'); }
      else m.classList.toggle('open');
      return;
    }
    set(id, b.getAttribute('data-set'));
    if (!b.getAttribute('data-set')) m.classList.remove('open');
  });
  function init() {
    var seen = {}, ms = document.querySelectorAll('.mark[data-work]');
    for (var i = 0; i < ms.length; i++) { var id = ms[i].getAttribute('data-work'); if (!seen[id]) { seen[id] = 1; paint(id); } }

    // the door: a known name opens its page; an unknown one says so (the live site stays silent)
    var door = document.getElementById('door');
    if (door) {
      var inp = door.querySelector('input'), miss = door.querySelector('.miss');
      door.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var v = (inp.value || '').trim().toLowerCase(); if (!v) return;
        var opts = document.querySelectorAll('#authors option'), hit = null;
        for (var k = 0; k < opts.length; k++) {
          var hay = (opts[k].value + ' ' + (opts[k].getAttribute('data-h') || '')).toLowerCase();
          if (hay.indexOf(v) >= 0) { hit = opts[k]; break; }
        }
        if (hit && hit.getAttribute('data-to')) { location.href = hit.getAttribute('data-to'); return; }
        miss.hidden = false;
      });
      inp.addEventListener('input', function () { miss.hidden = true; });
    }

    // index search — name, original script, or a book title
    var q = document.getElementById('q');
    if (q) {
      var fr = document.getElementById('fr'), fp = document.getElementById('fp'), cnt = document.getElementById('cnt');
      var items = document.querySelectorAll('.album li');
      var run = function () {
        var v = q.value.trim().toLowerCase(), r = fr.value, p = fp.value, n = 0;
        for (var i = 0; i < items.length; i++) {
          var li = items[i];
          var ok = (!v || (li.getAttribute('data-h') || '').indexOf(v) >= 0) &&
                   (!r || (' ' + li.getAttribute('data-r') + ' ').indexOf(' ' + r + ' ') >= 0) &&
                   (!p || (' ' + li.getAttribute('data-p') + ' ').indexOf(' ' + p + ' ') >= 0);
          li.hidden = !ok; if (ok) n++;
        }
        var secs = document.querySelectorAll('.album-sec');
        for (var s = 0; s < secs.length; s++) secs[s].hidden = !secs[s].querySelector('li:not([hidden])');
        cnt.textContent = (v || r || p) ? n + '인' : '';
      };
      q.addEventListener('input', run); fr.addEventListener('change', run); fp.addEventListener('change', run);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
