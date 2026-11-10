/**
 * Declarative event binding — replaces inline onclick/onchange/oninput
 * attributes so the Content-Security-Policy can forbid inline script.
 *
 *   <button data-action="logout">                         click  → logout()
 *   <button data-action="goToPage" data-args="[3]">       click  → goToPage(3)
 *   <select data-on-change="updateBookingStatus" data-pass="element">
 *                                                          change → updateBookingStatus(selectEl)
 *   <input type="checkbox" data-on-change="toggleUserStatus"
 *          data-args='["abc"]' data-pass="checked">        change → toggleUserStatus("abc", true)
 *   <input data-on-input="cleanSearchInput" data-pass="element">
 *
 * data-args is a JSON array. data-pass appends one extra argument:
 *   "element" → the element, "checked" → element.checked,
 *   "value" → element.value, "event" → the DOM event.
 * Handler names are global functions, or dotted paths such as "i18n.toggleLang".
 * Load this file before page scripts; it needs no DOMContentLoaded.
 */
(function () {
  'use strict';

  function resolve(path) {
    var parts = String(path).split('.');
    var owner = window;
    var target = window;
    for (var i = 0; i < parts.length; i++) {
      owner = target;
      target = target ? target[parts[i]] : undefined;
    }
    return typeof target === 'function' ? { fn: target, owner: owner } : null;
  }

  function argsFor(el, event) {
    var args = [];
    if (el.dataset.args) {
      try {
        args = JSON.parse(el.dataset.args);
        if (!Array.isArray(args)) args = [args];
      } catch (err) {
        console.error('actions.js: invalid data-args on', el, err);
        return null;
      }
    }
    switch (el.dataset.pass) {
      case 'element': args.push(el); break;
      case 'checked': args.push(el.checked); break;
      case 'value': args.push(el.value); break;
      case 'event': args.push(event); break;
      default: break; // nothing extra: handlers are called with exactly data-args
    }
    return args;
  }

  function dispatch(attr, event) {
    var el = event.target && event.target.closest ? event.target.closest('[' + attr + ']') : null;
    if (!el || el.disabled) return;
    var name = el.getAttribute(attr);
    var handler = resolve(name);
    if (!handler) {
      console.error('actions.js: no handler named "' + name + '"');
      return;
    }
    var args = argsFor(el, event);
    if (args) handler.fn.apply(handler.owner, args);
  }

  document.addEventListener('click', function (e) { dispatch('data-action', e); });
  document.addEventListener('change', function (e) { dispatch('data-on-change', e); });
  document.addEventListener('input', function (e) { dispatch('data-on-input', e); });

  // Keyboard support for non-button elements that act as buttons
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var el = e.target;
    if (el && el.matches && el.matches('[data-action][role="button"]')) {
      e.preventDefault();
      el.click();
    }
  });
})();
