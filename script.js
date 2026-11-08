(function () {
  "use strict";

  var CONFIG = window.INVITE_CONFIG || {};
  var SCRIPT_URL = (CONFIG.scriptUrl || "").trim();
  var STORAGE_KEY = "yubiley45-rsvp";

  // Праздник: 24 ноября 2026, 17:00 (местное время гостя)
  var EVENT = {
    title: "Юбилей Алексея Сергеевича — 45 лет",
    start: new Date(2026, 10, 24, 17, 0, 0),
    durationHours: 4,
    location: "Баня, ул. Катаева, 116",
    details: "Банные принадлежности и алкоголь — с собой!"
  };

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- безопасный localStorage ---------------- */
  function store(key, value) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { /* приватный режим и т.п. */ }
  }
  function load(key) {
    try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (e) { return null; }
  }

  /* ---------------- появление блоков при прокрутке ---------------- */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---------------- обратный отсчёт ---------------- */
  var cd = {
    d: document.getElementById("cd-d"),
    h: document.getElementById("cd-h"),
    m: document.getElementById("cd-m"),
    s: document.getElementById("cd-s")
  };
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function tick() {
    var diff = EVENT.start.getTime() - Date.now();
    if (diff <= 0) {
      document.getElementById("countdown").hidden = true;
      document.getElementById("cd-done").hidden = false;
      return false;
    }
    var s = Math.floor(diff / 1000);
    cd.d.textContent = pad(Math.floor(s / 86400));
    cd.h.textContent = pad(Math.floor((s % 86400) / 3600));
    cd.m.textContent = pad(Math.floor((s % 3600) / 60));
    cd.s.textContent = pad(s % 60);
    return true;
  }
  if (tick()) {
    var timer = setInterval(function () { if (!tick()) clearInterval(timer); }, 1000);
  }

  /* ---------------- календарь ---------------- */
  function fmtLocal(d) {
    return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + "T" +
      pad(d.getHours()) + pad(d.getMinutes()) + "00";
  }
  var endDate = new Date(EVENT.start.getTime() + EVENT.durationHours * 3600 * 1000);

  var gcalUrl = "https://calendar.google.com/calendar/render?action=TEMPLATE" +
    "&text=" + encodeURIComponent(EVENT.title) +
    "&dates=" + fmtLocal(EVENT.start) + "/" + fmtLocal(endDate) +
    "&details=" + encodeURIComponent(EVENT.details) +
    "&location=" + encodeURIComponent(EVENT.location);
  document.querySelectorAll(".js-gcal").forEach(function (a) { a.href = gcalUrl; });

  /* ---------------- анкета ---------------- */
  var form = document.getElementById("rsvp-form");
  var rsvpCard = document.getElementById("rsvp");
  var yesCard = document.getElementById("result-yes");
  var noCard = document.getElementById("result-no");
  var submitBtn = document.getElementById("submit-btn");
  var formError = document.getElementById("form-error");

  if (!SCRIPT_URL) document.getElementById("setup-note").hidden = false;

  function setError(name, msg) {
    var p = form.querySelector('.err[data-for="' + name + '"]');
    if (p) p.textContent = msg || "";
    var input = form.elements[name];
    if (input && input.closest) {
      var field = input.closest(".field");
      if (field) field.classList.toggle("invalid", !!msg);
    }
  }

  function cleanName(v) {
    return (v || "").replace(/\s+/g, " ").trim();
  }
  function capitalize(v) {
    return v.replace(/(^|[\s-])(\S)/g, function (m, sep, ch) { return sep + ch.toUpperCase(); });
  }

  function validate() {
    var ok = true;
    var first = cleanName(form.elements.firstName.value);
    var last = cleanName(form.elements.lastName.value);
    var att = form.querySelector('input[name="attending"]:checked');
    var nameRe = /^[A-Za-zА-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі' .-]{2,40}$/;

    if (!first) { setError("firstName", "Напишите, пожалуйста, имя"); ok = false; }
    else if (!nameRe.test(first)) { setError("firstName", "Только буквы, минимум 2"); ok = false; }
    else setError("firstName", "");

    if (!last) { setError("lastName", "Напишите, пожалуйста, фамилию"); ok = false; }
    else if (!nameRe.test(last)) { setError("lastName", "Только буквы, минимум 2"); ok = false; }
    else setError("lastName", "");

    if (!att) { setError("attending", "Выберите вариант ответа"); ok = false; }
    else setError("attending", "");

    return ok ? { firstName: capitalize(first), lastName: capitalize(last), attending: att.value } : null;
  }

  ["firstName", "lastName"].forEach(function (n) {
    form.elements[n].addEventListener("input", function () { setError(n, ""); });
  });
  form.querySelectorAll('input[name="attending"]').forEach(function (r) {
    r.addEventListener("change", function () { setError("attending", ""); });
  });

  function send(data) {
    if (!SCRIPT_URL) {
      console.warn("[Приглашение] scriptUrl не задан в config.js — ответ не отправлен:", data);
      return new Promise(function (res) { setTimeout(res, 700); });
    }
    var body = new URLSearchParams();
    body.append("firstName", data.firstName);
    body.append("lastName", data.lastName);
    body.append("attending", data.attending);
    // no-cors: Google Apps Script не отдаёт CORS-заголовки; ответ «непрозрачный»,
    // но сам запрос доходит. Ошибка сети всё равно приведёт к reject.
    return fetch(SCRIPT_URL, { method: "POST", mode: "no-cors", body: body });
  }

  function showResult(data, celebrate) {
    var card = data.attending === "yes" ? yesCard : noCard;
    document.querySelectorAll(".js-name").forEach(function (el) { el.textContent = data.firstName; });
    rsvpCard.hidden = true;
    yesCard.hidden = card !== yesCard;
    noCard.hidden = card !== noCard;
    if (celebrate) {
      card.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      setTimeout(function () { card.focus({ preventScroll: true }); }, 400);
      if (data.attending === "yes") setTimeout(function () { burst(card); }, 250);
    }
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    formError.textContent = "";
    if (form.elements.website.value) return; // бот
    var data = validate();
    if (!data) {
      var firstBad = form.querySelector(".invalid input");
      if (firstBad) firstBad.focus();
      return;
    }
    submitBtn.classList.add("loading");
    submitBtn.querySelector(".btn-label").textContent = "Отправляем…";

    send(data).then(function () {
      store(STORAGE_KEY, { firstName: data.firstName, lastName: data.lastName, attending: data.attending, at: Date.now() });
      showResult(data, true);
    }).catch(function () {
      formError.textContent = "Не удалось отправить ответ. Проверьте интернет и попробуйте ещё раз.";
    }).then(function () {
      submitBtn.classList.remove("loading");
      submitBtn.querySelector(".btn-label").textContent = "Отправить ответ";
    });
  });

  document.querySelectorAll(".js-change").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var saved = load(STORAGE_KEY);
      yesCard.hidden = true;
      noCard.hidden = true;
      rsvpCard.hidden = false;
      rsvpCard.classList.add("in");
      if (saved) {
        form.elements.firstName.value = saved.firstName || "";
        form.elements.lastName.value = saved.lastName || "";
      }
      form.querySelectorAll('input[name="attending"]').forEach(function (r) { r.checked = false; });
      rsvpCard.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    });
  });

  // гость уже отвечал с этого устройства
  var saved = load(STORAGE_KEY);
  if (saved && saved.firstName && (saved.attending === "yes" || saved.attending === "no")) {
    showResult(saved, false);
  }

  /* ---------------- угольки + праздничный салют ---------------- */
  var canvas = document.getElementById("embers");
  var ctx = canvas.getContext && canvas.getContext("2d");
  if (!ctx) return;

  var W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2);
  var embers = [];
  var confetti = [];
  var running = true;
  var rafId = 0;

  function start() {
    running = true;
    if (!rafId) rafId = requestAnimationFrame(frame);
  }

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    var target = reduceMotion ? 0 : Math.round(Math.min(70, Math.max(26, W / 18)));
    while (embers.length < target) embers.push(makeEmber(true));
    if (embers.length > target) embers.length = target;
  }

  function rand(a, b) { return a + Math.random() * (b - a); }

  function makeEmber(anywhere) {
    return {
      x: rand(0, W),
      y: anywhere ? rand(0, H) : H + rand(5, 60),
      r: rand(0.6, 2.2),
      vy: rand(0.18, 0.7),
      drift: rand(0.2, 0.9),
      phase: rand(0, Math.PI * 2),
      hue: rand(22, 42),
      life: rand(0.5, 1)
    };
  }

  var GOLDS = ["#f6dca4", "#e0b46a", "#c8893e", "#fff1cf", "#e8743b"];

  function burst(el) {
    if (reduceMotion) return;
    var rect = el.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = Math.max(60, rect.top + 60);
    for (var i = 0; i < 140; i++) {
      var a = rand(0, Math.PI * 2);
      var sp = rand(3, 10);
      confetti.push({
        x: cx, y: cy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 4,
        w: rand(4, 9), h: rand(2.5, 5),
        rot: rand(0, Math.PI), vr: rand(-0.25, 0.25),
        color: GOLDS[(Math.random() * GOLDS.length) | 0],
        life: 1
      });
    }
    if (!document.hidden) start();
  }

  var t = 0;
  function frame() {
    rafId = 0;
    if (!running) return;
    t += 0.016;
    ctx.clearRect(0, 0, W, H);

    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < embers.length; i++) {
      var p = embers[i];
      p.y -= p.vy;
      p.x += Math.sin(t * p.drift + p.phase) * 0.35;
      var fade = Math.min(1, p.y / (H * 0.35));
      var flicker = 0.55 + 0.45 * Math.sin(t * 3 + p.phase * 5);
      var alpha = Math.max(0, fade * flicker * p.life);
      if (p.y < -10) embers[i] = makeEmber(false);
      var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
      g.addColorStop(0, "hsla(" + p.hue + ",95%,72%," + alpha + ")");
      g.addColorStop(1, "hsla(" + p.hue + ",95%,55%,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";

    for (var j = confetti.length - 1; j >= 0; j--) {
      var c = confetti[j];
      c.vy += 0.18;
      c.vx *= 0.985;
      c.vy *= 0.985;
      c.x += c.vx;
      c.y += c.vy;
      c.rot += c.vr;
      c.life -= 0.006;
      if (c.life <= 0 || c.y > H + 20) { confetti.splice(j, 1); continue; }
      ctx.save();
      ctx.globalAlpha = Math.min(1, c.life * 1.4);
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.fillStyle = c.color;
      ctx.fillRect(-c.w / 2, -c.h / 2 * Math.abs(Math.cos(c.rot * 2)), c.w, c.h * Math.abs(Math.cos(c.rot * 2)) + 0.5);
      ctx.restore();
    }

    if (!embers.length && !confetti.length) { running = false; ctx.clearRect(0, 0, W, H); return; }
    rafId = requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      running = false;
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    } else {
      start();
    }
  });
  resize();
  start();
})();
