/*
 * Voice input (speech to text) and output (text to speech) using the browser's Web Speech API.
 * Nothing here pretends to work: if the browser lacks support, or has no voice for the chosen language,
 * the functions say so and the pages fall back to typing.
 * Privacy: in most browsers speech recognition sends audio to the browser vendor's service.
 */
(function () {
  'use strict';
  var RHP = (window.RHP = window.RHP || {});

  function Recognition() { return window.SpeechRecognition || window.webkitSpeechRecognition || null; }

  // ---------- pure helpers (unit tested) ----------
  var FACILITY_WORDS = [
    ['PHC', ['phc', 'primary health', '\u0CAA\u0CCD\u0CB0\u0CBE\u0CA5\u0CAE\u0CBF\u0C95 \u0C86\u0CB0\u0CCB\u0C97\u0CCD\u0CAF', '\u092A\u094D\u0930\u093E\u0925\u092E\u093F\u0915 \u0938\u094D\u0935\u093E\u0938\u094D\u0925\u094D\u092F']],
    ['CHC', ['chc', 'community health', '\u0CB8\u0CAE\u0CC1\u0CA6\u0CBE\u0CAF \u0C86\u0CB0\u0CCB\u0C97\u0CCD\u0CAF', '\u0938\u093E\u092E\u0941\u0926\u093E\u092F\u093F\u0915 \u0938\u094D\u0935\u093E\u0938\u094D\u0925\u094D\u092F']],
    ['CLINIC', ['clinic', '\u0C95\u0CCD\u0CB2\u0CBF\u0CA8\u0CBF\u0C95\u0CCD', '\u0915\u094D\u0932\u093F\u0928\u093F\u0915']],
    ['HOSPITAL', ['hospital', '\u0C86\u0CB8\u0CCD\u0CAA\u0CA4\u0CCD\u0CB0\u0CC6', '\u0905\u0938\u094D\u092A\u0924\u093E\u0932']]
  ];
  /** "nearest hospital" / "ಆಸ್ಪತ್ರೆ" / "अस्पताल" -> 'HOSPITAL'; unknown -> null (meaning: all kinds of facility). */
  function facilityTypeFromText(text) {
    var s = String(text || '').toLowerCase();
    for (var i = 0; i < FACILITY_WORDS.length; i++) {
      for (var j = 0; j < FACILITY_WORDS[i][1].length; j++) {
        if (s.indexOf(FACILITY_WORDS[i][1][j]) >= 0) return FACILITY_WORDS[i][0];
      }
    }
    return null;
  }
  /** Speech engines add trailing full stops and spaces; strip them so the text works as a search term. */
  function cleanTranscript(text) {
    return String(text || '').replace(/\s+/g, ' ').trim().replace(/[.\u0964?!,]+$/g, '').trim();
  }
  /** Maps a SpeechRecognition error name to a translation key ('' = say nothing). */
  function errorKey(code) {
    switch (code) {
      case 'not-allowed': case 'service-not-allowed': return 'voice.micDenied';
      case 'language-not-supported': return 'voice.langUnsupported';
      case 'audio-capture': return 'voice.noMic';
      case 'network': return 'error.NETWORK_ERROR';
      case 'aborted': return '';
      default: return 'voice.noSpeech';
    }
  }

  var voice = (RHP.voice = {
    facilityTypeFromText: facilityTypeFromText,
    cleanTranscript: cleanTranscript,
    errorKey: errorKey,
    recognitionSupported: function () { return !!Recognition(); },
    ttsSupported: function () { return typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined'; },

    /**
     * Starts listening in the current UI language. handlers: onStart, onInterim(text), onResult(text), onError(code), onEnd.
     * Returns {stop()} or null when unsupported.
     */
    listen: function (handlers) {
      var R = Recognition();
      if (!R) return null;
      var rec = new R();
      rec.lang = window.I18n.speechLocale();
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;
      var finalText = '';
      rec.onstart = function () { if (handlers.onStart) handlers.onStart(); };
      rec.onresult = function (ev) {
        var interim = '';
        for (var i = ev.resultIndex; i < ev.results.length; i++) {
          var chunk = ev.results[i][0].transcript;
          if (ev.results[i].isFinal) finalText += chunk; else interim += chunk;
        }
        if (interim && handlers.onInterim) handlers.onInterim(interim);
      };
      rec.onerror = function (ev) { if (handlers.onError) handlers.onError(ev.error); };
      rec.onend = function () {
        var text = cleanTranscript(finalText);
        if (text && handlers.onResult) handlers.onResult(text);
        if (handlers.onEnd) handlers.onEnd();
      };
      try { rec.start(); } catch (e) { if (handlers.onError) handlers.onError('audio-capture'); return null; }
      return { stop: function () { try { rec.stop(); } catch (e) { /* ignore */ } } };
    },

    // ---------- text to speech ----------
    _voices: function () {
      return new Promise(function (resolve) {
        var synth = window.speechSynthesis, list = synth.getVoices();
        if (list.length) { resolve(list); return; }
        var done = false;
        function finish() { if (!done) { done = true; resolve(synth.getVoices()); } }
        synth.addEventListener('voiceschanged', finish);
        setTimeout(finish, 1000);
      });
    },
    _voiceFor: function (lang) {
      var base = String(lang).toLowerCase().split('-')[0];
      return voice._voices().then(function (list) {
        return list.filter(function (v) { return v.lang && v.lang.toLowerCase().indexOf(base) === 0; })[0] || null;
      });
    },
    /** True only if this device really has a voice for the language (Kannada voices are often missing). */
    canSpeak: function (lang) {
      if (!voice.ttsSupported()) return Promise.resolve(false);
      return voice._voiceFor(lang || window.I18n.speechLocale()).then(function (v) { return !!v; });
    },
    /** Speaks the text; resolves true when finished, false if it could not be spoken. Never uses a wrong-language voice. */
    speak: function (text, lang) {
      if (!voice.ttsSupported()) return Promise.resolve(false);
      return voice._voiceFor(lang || window.I18n.speechLocale()).then(function (v) {
        if (!v) return false;
        window.speechSynthesis.cancel();
        return new Promise(function (resolve) {
          var u = new window.SpeechSynthesisUtterance(text);
          u.voice = v; u.lang = v.lang; u.rate = 0.9;
          u.onend = function () { resolve(true); };
          u.onerror = function () { resolve(false); };
          window.speechSynthesis.speak(u);
        });
      });
    },
    stopSpeaking: function () { if (voice.ttsSupported()) window.speechSynthesis.cancel(); }
  });
})();
