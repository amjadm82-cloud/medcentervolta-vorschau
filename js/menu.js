// Menü auf dem Handy, Rezept-Fenster und Rezept-Formular.
document.addEventListener("DOMContentLoaded", function () {
  /* ---------- Menü ---------- */
  var button = document.querySelector(".menu-toggle");
  var nav = document.getElementById("main-nav");
  if (button && nav) {
    button.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      button.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  /* ---------- Rezept-Fenster (Startseite) ---------- */
  var dialog = document.getElementById("rezept-dialog");
  if (dialog && typeof dialog.showModal === "function") {
    document.querySelectorAll("[data-open-rezept]").forEach(function (link) {
      link.addEventListener("click", function (event) {
        event.preventDefault();
        dialog.showModal();
        var form = dialog.querySelector(".rezept-form");
        if (form) loadToken(form);
        var first = dialog.querySelector("input:not([type=hidden]):not([tabindex='-1'])");
        if (first) first.focus();
      });
    });
    dialog.querySelectorAll("[data-close-rezept]").forEach(function (b) {
      b.addEventListener("click", function () { dialog.close(); });
    });
    // Klick neben das Fenster schliesst es
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) dialog.close();
    });
  }

  /* ---------- Fehlerhinweis nach Weiterleitung (ohne JavaScript gesendet) ---------- */
  if (/[?&]fehler=1/.test(location.search)) {
    var hint = document.getElementById("rezept-fehler");
    if (hint) hint.hidden = false;
  }

  /* ---------- Rezept-Formular ---------- */
  document.querySelectorAll(".rezept-form").forEach(function (form) {
    if (!dialog || !dialog.contains(form)) loadToken(form);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      submitForm(form);
    });
  });

  // Design-Vorschau auf GitHub Pages: dort läuft kein PHP, das Formular sendet nicht
  var PREVIEW = /\.github\.io$/.test(location.hostname);

  // Holt vom Server ein signiertes Zeit-Token (Spam-Schutz)
  function loadToken(form) {
    if (PREVIEW) return;
    var field = form.querySelector("input[name=token]");
    if (!field || field.value) return;
    fetch("rezept-senden.php?token=1", { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (data) { if (data && data.token) field.value = data.token; })
      .catch(function () { /* wird beim Absenden gemeldet */ });
  }

  function showMessage(form, text, isError) {
    var box = form.querySelector(".form-message");
    box.textContent = text;
    box.classList.add("is-visible");
    box.classList.toggle("is-error", !!isError);
    box.focus();
  }

  // Einfache Prüfung im Browser – der Server prüft alles noch einmal
  function validate(form) {
    var f = form.elements;
    var name = f.name.value.trim();
    var phone = f.telefon.value.trim();
    var msg = f.nachricht.value.trim();
    var dob = f.geburtsdatum.value;

    if (name.length < 2) return [f.name, "Bitte geben Sie Ihren Vor- und Nachnamen an."];
    if (!dob || new Date(dob) > new Date() || dob < "1900-01-01") return [f.geburtsdatum, "Bitte geben Sie ein gültiges Geburtsdatum an."];
    if (!/^[0-9+()\/ .\-]{6,30}$/.test(phone) || (phone.match(/\d/g) || []).length < 6) return [f.telefon, "Bitte geben Sie eine gültige Telefonnummer an."];
    if (!f.arzt.value) return [f.arzt, "Bitte wählen Sie Ihre Ärztin oder Ihren Arzt aus."];
    if (msg.length < 2) return [f.nachricht, "Bitte geben Sie das Medikament oder eine Nachricht an."];
    if (/(https?:\/\/|www\.)/i.test(msg)) return [f.nachricht, "Bitte keine Links in die Nachricht schreiben."];
    if (!f.datenschutz.checked) return [f.datenschutz, "Bitte bestätigen Sie die Datenschutzerklärung."];
    return null;
  }

  function submitForm(form) {
    var problem = validate(form);
    if (problem) {
      showMessage(form, problem[1], true);
      problem[0].focus();
      return;
    }

    if (PREVIEW) {
      showMessage(form, "Design-Vorschau: Hier wird das Formular nicht gesendet. Auf der echten Website geht die Anfrage direkt an die gewählte Ärztin bzw. den gewählten Arzt.", false);
      return;
    }

    var submit = form.querySelector("button[type=submit]");
    submit.disabled = true;
    submit.dataset.label = submit.dataset.label || submit.innerHTML;
    submit.textContent = "Wird gesendet …";

    // Seite direkt vom Computer geöffnet: es gibt keinen Server, der senden kann
    if (location.protocol === "file:") {
      showMessage(form, "Hinweis: Das Formular kann nur senden, wenn die Website auf dem Webserver liegt – nicht, wenn die Seite direkt vom Computer geöffnet wird.", true);
      submit.disabled = false;
      submit.innerHTML = submit.dataset.label;
      return;
    }

    fetch(form.action, {
      method: "POST",
      body: new FormData(form),
      headers: { "X-Requested-With": "fetch" }
    })
      .then(function (r) {
        return r.json().catch(function () {
          // Keine gültige Antwort: Server ohne PHP oder Fehler im Server-Skript
          throw new Error("Code " + r.status);
        });
      })
      .then(function (data) {
        if (data.ok) {
          form.reset();
          form.querySelector("input[name=token]").value = "";
          loadToken(form);
          showMessage(form, data.message, false);
        } else {
          showMessage(form, data.message, true);
        }
      })
      .catch(function (err) {
        var code = err && /^Code \d+$/.test(err.message) ? " (" + err.message + ")" : " (Server nicht erreichbar)";
        showMessage(form, "Ihre Anfrage konnte leider nicht gesendet werden. Bitte rufen Sie uns an: 061 322 61 11." + code, true);
      })
      .then(function () {
        submit.disabled = false;
        submit.innerHTML = submit.dataset.label;
      });
  }
});

// Google Maps erst nach Klick laden (Datenschutz)
document.addEventListener("click", function (event) {
  var button = event.target.closest("[data-load-map]");
  if (!button) return;
  var box = button.closest(".map-consent");
  var frame = document.createElement("iframe");
  frame.src = box.getAttribute("data-map-src");
  frame.title = "Karte: MedCenter Volta, Lothringerplatz 2, 4056 Basel";
  frame.loading = "lazy";
  frame.referrerPolicy = "no-referrer-when-downgrade";
  frame.allowFullscreen = true;
  box.innerHTML = "";
  box.appendChild(frame);
});
