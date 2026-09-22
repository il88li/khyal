/* ============================================================
   خَيال · 09-overlays · إدارة النوافذ العائمة
   الجزء 30 · modal · drawer · menu · tooltip · toast · confirm
   مكدّس موحّد · تركيز محفوظ · Esc/Tab · قفل تمرير · زر رجوع
   ============================================================ */

'use strict';

(function () {
  const K = window.K;
  if (!K) { console.error('[overlays] النواة غير محمّلة'); return; }


  /* ═══════════════════════════════════════════════════════════
     مكدّس موحّد لكل الطبقات النشطة
     ═══════════════════════════════════════════════════════════ */

  const stack = [];       // [{id, kind, node, portal, opts, restoreFocus}]
  const registry = new Map();   // id → entry
  let lockCount = 0;
  let originalScrollY = 0;

  const findTop = (kind) => {
    for (let i = stack.length - 1; i >= 0; i--) {
      if (!kind || stack[i].kind === kind) return stack[i];
    }
    return null;
  };

  const hasOpen = (kind) => !!findTop(kind);

  const isOpen = (id) => registry.has(id);


  /* ═══════════════════════════════════════════════════════════
     قفل تمرير الصفحة
     ═══════════════════════════════════════════════════════════ */

  const lockScroll = () => {
    if (lockCount === 0) {
      originalScrollY = window.scrollY || 0;
      const body = document.body;
      body.style.overflow = 'hidden';
      body.style.position = 'fixed';
      body.style.insetInline = '0';
      body.style.width = '100%';
      body.style.top = `${-originalScrollY}px`;
      // إبلاغ الأشرطة
      document.documentElement.dataset.overlayOpen = 'true';
    }
    lockCount += 1;
  };

  const unlockScroll = () => {
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) {
      const body = document.body;
      body.style.overflow = '';
      body.style.position = '';
      body.style.insetInline = '';
      body.style.width = '';
      body.style.top = '';
      window.scrollTo(0, originalScrollY);
      delete document.documentElement.dataset.overlayOpen;
    }
  };


  /* ═══════════════════════════════════════════════════════════
     إدارة التركيز
     ═══════════════════════════════════════════════════════════ */

  const FOCUSABLE_SEL = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
  ].join(',');

  const getFocusable = (root) => {
    if (!root) return [];
    return Array.from(root.querySelectorAll(FOCUSABLE_SEL))
      .filter(el => el.offsetParent !== null || el === document.activeElement);
  };

  const trapFocus = (node, evt) => {
    if (evt.key !== 'Tab') return;
    const focusable = getFocusable(node);
    if (!focusable.length) {
      evt.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (evt.shiftKey && (active === first || !node.contains(active))) {
      evt.preventDefault();
      last.focus();
    } else if (!evt.shiftKey && active === last) {
      evt.preventDefault();
      first.focus();
    }
  };

  const restoreFocusTo = (el) => {
    K.raf.write(() => {
      try {
        if (el && el.focus && document.contains(el)) {
          el.focus({ preventScroll: true });
        } else if (document.body) {
          document.body.focus({ preventScroll: true });
        }
      } catch { /* تجاهل */ }
    });
  };


  /* ═══════════════════════════════════════════════════════════
     إنشاء Portal (حاوية معزولة)
     ═══════════════════════════════════════════════════════════ */

  const createPortal = (zIndex = null) => {
    const portal = K.dom.el('div', {
      cls: 'k-portal',
      attrs: { role: 'presentation' },
      data: { open: 'true' },
    });
    if (zIndex) portal.style.zIndex = String(zIndex);
    document.body.appendChild(portal);
    return portal;
  };

  const createBackdrop = (opts = {}) => {
    const backdrop = K.dom.el('div', {
      cls: 'k-backdrop',
      attrs: { 'aria-hidden': 'true' },
    });
    if (opts.onClick !== false) {
      backdrop.addEventListener('click', () => {
        const top = findTop();
        if (!top) return;
        // لا يُغلق إن كان requiresAction
        if (top.opts.requiresAction) return;
        close(top.id);
      }, { passive: true });
    }
    return backdrop;
  };


  /* ═══════════════════════════════════════════════════════════
     الفتح/الإغلاق العام
     ═══════════════════════════════════════════════════════════ */

  const open = (entry) => {
    const {
      id, kind, node, portal, opts,
    } = entry;

    // احفظ العنصر الذي كان في التركيز
    entry.restoreFocus = document.activeElement;

    // سجّل
    registry.set(id, entry);
    stack.push(entry);

    // قفل التمرير إن طُلب
    if (opts.lockScroll !== false) lockScroll();

    // اربط لوحة المفاتيح
    const onKeyDown = (evt) => {
      // Esc
      if (evt.key === 'Escape' && opts.closeOnEsc !== false) {
        const top = findTop();
        if (top && top.id === id) {
          evt.preventDefault();
          close(id);
        }
        return;
      }
      // Tab trap
      if (opts.trapFocus !== false) trapFocus(node, evt);
    };

    entry.__onKeyDown__ = onKeyDown;
    document.addEventListener('keydown', onKeyDown, false);

    // أعلن للمشتركين
    K.utils.tryCatch(() => K.events.emit(document, 'khayal:overlay-open', { id, kind }));

    // حرّك التركيز
    if (opts.autoFocus !== false) {
      K.raf.write(() => {
        const target = opts.initialFocus
          ? (typeof opts.initialFocus === 'string'
              ? node.querySelector(opts.initialFocus)
              : opts.initialFocus)
          : getFocusable(node)[0];
        if (target) {
          try { target.focus({ preventScroll: true }); } catch { /* */ }
        } else {
          // اجعل الحاوية قابلة للتركيز
          node.setAttribute('tabindex', '-1');
          try { node.focus({ preventScroll: true }); } catch { /* */ }
        }
      });
    }

    return id;
  };

  const close = (id) => {
    const entry = registry.get(id);
    if (!entry) return false;
    const { node, portal, opts, restoreFocus } = entry;

    // أزل المستمع
    if (entry.__onKeyDown__) {
      document.removeEventListener('keydown', entry.__onKeyDown__, false);
    }

    // أضف حالة "إغلاق" ثم أزل بعد انتهاء الحركة
    portal.dataset.closing = 'true';

    const finalize = () => {
      K.dom.remove(portal);
      registry.delete(id);
      const idx = stack.findIndex(e => e.id === id);
      if (idx !== -1) stack.splice(idx, 1);
      if (opts.lockScroll !== false) unlockScroll();

      // أعد التركيز
      if (opts.restoreFocus !== false) restoreFocusTo(restoreFocus);

      if (typeof opts.onClosed === 'function') {
        K.utils.tryCatch(() => opts.onClosed());
      }

      // إن لم يبقَ شيء، أبلغ
      if (!stack.length) {
        K.utils.tryCatch(() => K.events.emit(document, 'khayal:overlay-all-closed', {}));
      }
    };

    // يُشغّل بعد الحركة · أو فوراً إن كانت معطّلة
    const duration = K.support.reducedMotion ? 0 : 220;
    setTimeout(finalize, duration);

    K.utils.tryCatch(() => K.events.emit(document, 'khayal:overlay-close', { id, kind: entry.kind }));

    if (typeof opts.onClose === 'function') {
      K.utils.tryCatch(() => opts.onClose());
    }

    return true;
  };

  const closeTop = (kind) => {
    const top = findTop(kind);
    if (!top) return false;
    return close(top.id);
  };

  const closeAll = (kind) => {
    const ids = stack
      .filter(e => !kind || e.kind === kind)
      .map(e => e.id)
      .reverse();
    for (const id of ids) close(id);
    return ids.length;
  };


  /* ═══════════════════════════════════════════════════════════
     زر الرجوع في المتصفح
     ═══════════════════════════════════════════════════════════ */

  const backHandlerAttached = { value: false };

  const attachBackHandler = () => {
    if (backHandlerAttached.value) return;
    backHandlerAttached.value = true;

    // عند كل فتح نافذة، ادفع حالة → زر الرجوع يُغلقها بدل تغيير المسار
    const onOpen = () => {
      if (stack.length === 1) {
        history.pushState({ __overlay__: true }, '');
      }
    };

    const onPopState = (evt) => {
      if (stack.length > 0) {
        const top = findTop();
        if (top) {
          // أغلقه يدوياً بلا pushState آخر
          const { node, portal, opts, restoreFocus } = top;
          if (top.__onKeyDown__) {
            document.removeEventListener('keydown', top.__onKeyDown__, false);
          }
          portal.dataset.closing = 'true';
          const finalize = () => {
            K.dom.remove(portal);
            registry.delete(top.id);
            const idx = stack.findIndex(e => e.id === top.id);
            if (idx !== -1) stack.splice(idx, 1);
            if (opts.lockScroll !== false) unlockScroll();
            if (opts.restoreFocus !== false) restoreFocusTo(restoreFocus);
            if (typeof opts.onClosed === 'function') K.utils.tryCatch(() => opts.onClosed());
            // إن بقي شيء آخر، أعد الدفع
            if (stack.length > 0) history.pushState({ __overlay__: true }, '');
          };
          const duration = K.support.reducedMotion ? 0 : 200;
          setTimeout(finalize, duration);
        }
      }
    };

    K.events.on(document, 'khayal:overlay-open', onOpen);
    window.addEventListener('popstate', onPopState, { passive: true });
  };


  /* ═══════════════════════════════════════════════════════════
     الجزء 30 · النافذة المنبثقة (Modal)
     ═══════════════════════════════════════════════════════════ */

  /**
   * يفتح نافذة منبثقة.
   * @param {object} opts
   * @param {string} [opts.id]        معرّف للتتبع (افتراضي عشوائي)
   * @param {string} [opts.title]
   * @param {string} [opts.subtitle]
   * @param {Node|Node[]} opts.body   المحتوى (عقدة أو مصفوفة)
   * @param {Array} [opts.actions]    [{label, variant, onClick, closeAfter, loading}]
   * @param {'sm'|'md'|'lg'|'xl'} [opts.size='md']
   * @param {boolean} [opts.closeOnBackdrop=true]
   * @param {boolean} [opts.closeOnEsc=true]
   * @param {boolean} [opts.showClose=true]
   * @param {boolean} [opts.requiresAction=false]  لا يُغلق إلا بزر
   * @param {Function} [opts.onClose]
   * @param {Function} [opts.onClosed]
   * @param {string|Element} [opts.initialFocus]
   */
  const modal = (opts = {}) => {
    const id = opts.id || K.utils.uid('modal');
    if (registry.has(id)) return id;

    const portal = createPortal();
    const backdrop = createBackdrop({
      onClick: opts.closeOnBackdrop !== false
        ? () => close(id)
        : false,
    });
    portal.appendChild(backdrop);

    const sizeClass = opts.size ? ` k-modal--${opts.size}` : '';
    const dialog = K.dom.el('div', {
      cls: `k-modal${sizeClass}`,
      attrs: {
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': opts.title ? `${id}-title` : null,
      },
    });

    // المقبض (للجوال)
    dialog.appendChild(K.dom.el('div', { cls: 'k-modal__grabber', attrs: { 'aria-hidden': 'true' } }));

    // الرأس
    if (opts.title || opts.showClose !== false) {
      const header = K.dom.el('div', { cls: 'k-modal__header' });

      if (opts.title) {
        const titleGroup = K.dom.el('div', { cls: 'k-modal__title-group' });
        titleGroup.appendChild(K.dom.el('h2', {
          cls: 'k-modal__title',
          text: opts.title,
          attrs: { id: `${id}-title` },
        }));
        if (opts.subtitle) {
          titleGroup.appendChild(K.dom.el('p', {
            cls: 'k-modal__subtitle',
            text: opts.subtitle,
          }));
        }
        header.appendChild(titleGroup);
      } else {
        // فراغ يدفع زر الإغلاق
        header.appendChild(K.dom.el('div', { attrs: { style: 'flex:1' } }));
      }

      if (opts.showClose !== false && !opts.requiresAction) {
        const closeBtn = K.dom.el('button', {
          cls: 'k-modal__close',
          attrs: { type: 'button', 'aria-label': 'إغلاق' },
        });
        closeBtn.appendChild(K.icons.get('x', { size: 18 }));
        closeBtn.addEventListener('click', () => close(id));
        header.appendChild(closeBtn);
      }

      dialog.appendChild(header);
    }

    // الجسم
    const body = K.dom.el('div', { cls: 'k-modal__body' });
    const content = opts.body;
    if (Array.isArray(content)) {
      for (const c of content) if (c) body.appendChild(c);
    } else if (content instanceof Node) {
      body.appendChild(content);
    } else if (typeof content === 'string') {
      body.textContent = content;
    }
    dialog.appendChild(body);

    // الذيل
    if (Array.isArray(opts.actions) && opts.actions.length) {
      const footer = K.dom.el('div', {
        cls: `k-modal__footer${opts.actions.length > 2 ? ' k-modal__footer--stack' : ''}`,
      });

      for (const action of opts.actions) {
        const btn = K.dom.el('button', {
          cls: `k-btn k-btn--md k-btn--${action.variant || 'secondary'}`,
          attrs: { type: 'button' },
        });
        btn.textContent = action.label;

        if (action.loading) {
          btn.dataset.loading = 'true';
          btn.setAttribute('aria-busy', 'true');
        }

        btn.addEventListener('click', async (evt) => {
          if (btn.dataset.loading === 'true') return;
          if (typeof action.onClick !== 'function') {
            if (action.closeAfter !== false) close(id);
            return;
          }

          // حالة التحميل
          if (action.showLoading !== false) {
            btn.dataset.loading = 'true';
            btn.setAttribute('aria-busy', 'true');
          }

          try {
            const result = await Promise.resolve(action.onClick(evt, { close: () => close(id) }));
            // إن أرجع false صراحة → لا نُغلق
            if (result === false) {
              delete btn.dataset.loading;
              btn.removeAttribute('aria-busy');
              return;
            }
            if (action.closeAfter !== false) close(id);
          } catch (err) {
            delete btn.dataset.loading;
            btn.removeAttribute('aria-busy');
            if (action.onError) K.utils.tryCatch(() => action.onError(err));
            else console.warn('[modal.action]', err);
          }
        });

        footer.appendChild(btn);
      }

      dialog.appendChild(footer);
    }

    portal.appendChild(dialog);

    return open({
      id,
      kind: 'modal',
      node: dialog,
      portal,
      opts: {
        lockScroll: opts.lockScroll !== false,
        closeOnEsc: opts.closeOnEsc !== false,
        trapFocus: true,
        autoFocus: true,
        restoreFocus: true,
        initialFocus: opts.initialFocus,
        requiresAction: !!opts.requiresAction,
        onClose: opts.onClose,
        onClosed: opts.onClosed,
      },
    });
  };


  /* ═══════════════════════════════════════════════════════════
     نافذة تأكيد — اختصار
     ═══════════════════════════════════════════════════════════ */

  /**
   * @param {object} opts
   * @param {string} opts.title
   * @param {string} [opts.message]
   * @param {'info'|'warning'|'danger'} [opts.variant='warning']
   * @param {string} [opts.confirmLabel='تأكيد']
   * @param {string} [opts.cancelLabel='إلغاء']
   * @param {boolean} [opts.destructive=false]
   * @returns {Promise<boolean>}
   */
  const confirm = (opts = {}) => new Promise((resolve) => {
    const id = K.utils.uid('confirm');
    let answered = false;

    const iconName = opts.variant === 'danger' ? 'warning-octagon'
      : opts.variant === 'info' ? 'info'
      : 'warning';

    const icon = K.dom.el('div', {
      cls: `k-confirm__icon${opts.variant === 'danger' ? ' k-confirm__icon--danger'
        : opts.variant === 'warning' ? ' k-confirm__icon--warning'
        : ' k-confirm__icon--info'}`,
    });
    icon.appendChild(K.icons.get(iconName, { size: 24, stroke: 1.75 }));

    const body = K.dom.el('div');
    body.appendChild(icon);
    if (opts.message) {
      body.appendChild(K.dom.el('p', {
        text: opts.message,
        attrs: { style: 'margin:0;color:var(--k-text-secondary);line-height:var(--k-lh-relaxed);font-size:var(--k-fs-sm);' },
      }));
    }

    modal({
      id,
      size: 'sm',
      title: opts.title,
      body,
      requiresAction: true,
      showClose: false,
      closeOnBackdrop: false,
      closeOnEsc: true,
      initialFocus: opts.destructive ? null : 'button.k-btn--secondary',
      actions: [
        {
          label: opts.cancelLabel || 'إلغاء',
          variant: 'secondary',
          onClick: () => { answered = true; resolve(false); },
        },
        {
          label: opts.confirmLabel || 'تأكيد',
          variant: opts.destructive || opts.variant === 'danger' ? 'danger' : 'primary',
          onClick: () => { answered = true; resolve(true); },
        },
      ],
      onClosed: () => {
        if (!answered) resolve(false);
      },
    });
  });


  /* ═══════════════════════════════════════════════════════════
     الدرج الجانبي (Drawer)
     ═══════════════════════════════════════════════════════════ */

  /**
   * @param {object} opts
   * @param {'start'|'end'} [opts.side='start']
   * @param {string} [opts.title]
   * @param {Node|Node[]} [opts.body]
   * @param {Node|Node[]} [opts.footer]
   * @param {boolean} [opts.showClose=true]
   */
  const drawer = (opts = {}) => {
    const id = opts.id || K.utils.uid('drawer');
    if (registry.has(id)) return id;

    const portal = createPortal();
    const backdrop = createBackdrop({ onClick: () => close(id) });
    portal.appendChild(backdrop);

    const node = K.dom.el('aside', {
      cls: 'k-drawer',
      attrs: {
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': opts.title || 'قائمة جانبية',
      },
      data: { side: opts.side || 'start' },
    });

    // الرأس
    if (opts.title !== undefined || opts.showClose !== false) {
      const header = K.dom.el('div', { cls: 'k-drawer__header' });
      if (opts.title) {
        header.appendChild(K.dom.el('h2', {
          cls: 'k-drawer__title',
          text: opts.title,
        }));
      }
      if (opts.showClose !== false) {
        const btn = K.dom.el('button', {
          cls: 'k-modal__close',
          attrs: { type: 'button', 'aria-label': 'إغلاق' },
        });
        btn.appendChild(K.icons.get('x', { size: 18 }));
        btn.addEventListener('click', () => close(id));
        header.appendChild(btn);
      }
      node.appendChild(header);
    }

    // الجسم
    const body = K.dom.el('div', { cls: 'k-drawer__body' });
    if (Array.isArray(opts.body)) {
      for (const c of opts.body) if (c) body.appendChild(c);
    } else if (opts.body instanceof Node) {
      body.appendChild(opts.body);
    }
    node.appendChild(body);

    // التذييل
    if (opts.footer) {
      const footer = K.dom.el('div', { cls: 'k-drawer__footer' });
      if (Array.isArray(opts.footer)) {
        for (const c of opts.footer) if (c) footer.appendChild(c);
      } else if (opts.footer instanceof Node) {
        footer.appendChild(opts.footer);
      }
      node.appendChild(footer);
    }

    portal.appendChild(node);

    return open({
      id,
      kind: 'drawer',
      node,
      portal,
      opts: {
        lockScroll: true,
        closeOnEsc: true,
        trapFocus: true,
        autoFocus: true,
        restoreFocus: true,
        onClose: opts.onClose,
        onClosed: opts.onClosed,
      },
    });
  };


  /* ═══════════════════════════════════════════════════════════
     القائمة المنسدلة (Menu)
     ═══════════════════════════════════════════════════════════ */

  /**
   * @param {object} opts
   * @param {Element} opts.anchor     العنصر المرجعي
   * @param {Array} opts.items        [{label, icon, shortcut, danger, disabled, onClick, divider}]
   * @param {'bottom'|'top'} [opts.placement='bottom']
   */
  const menu = (opts = {}) => {
    const id = opts.id || K.utils.uid('menu');
    if (registry.has(id)) return id;

    const anchor = opts.anchor;
    if (!anchor || !document.contains(anchor)) return null;

    const portal = createPortal();
    const backdrop = createBackdrop({ onClick: () => close(id) });
    backdrop.style.background = 'transparent';   // شفاف للقوائم
    portal.appendChild(backdrop);

    const node = K.dom.el('div', {
      cls: 'k-menu',
      attrs: { role: 'menu' },
      data: { placement: opts.placement || 'bottom' },
    });

    for (const item of opts.items || []) {
      if (item.divider) {
        node.appendChild(K.dom.el('div', { cls: 'k-menu__separator', attrs: { role: 'separator' } }));
        continue;
      }

      const btn = K.dom.el('button', {
        cls: `k-menu__item${item.danger ? ' k-menu__item--danger' : ''}`,
        attrs: {
          type: 'button',
          role: 'menuitem',
          disabled: item.disabled || null,
        },
      });

      if (item.icon) {
        btn.appendChild(K.icons.get(item.icon, { size: 18 }));
      }
      btn.appendChild(K.dom.el('span', { text: item.label }));

      if (item.shortcut) {
        btn.appendChild(K.dom.el('span', { cls: 'k-menu__shortcut', text: item.shortcut }));
      }

      btn.addEventListener('click', async (evt) => {
        if (item.disabled) return;
        if (typeof item.onClick === 'function') {
          try {
            const r = await Promise.resolve(item.onClick(evt));
            if (r !== false) close(id);
          } catch (err) {
            console.warn('[menu.item]', err);
            close(id);
          }
        } else {
          close(id);
        }
      });

      node.appendChild(btn);
    }

    // موضع القائمة
    const position = () => {
      const rect = anchor.getBoundingClientRect();
      const menuRect = node.getBoundingClientRect();
      const margin = 8;
      const placement = opts.placement || 'bottom';

      let top, left;

      if (placement === 'top') {
        top = rect.top - menuRect.height - margin;
      } else {
        top = rect.bottom + margin;
      }

      // افتراضياً: من النهاية (يمين في RTL)
      if (opts.align === 'start') {
        left = rect.left;
      } else {
        left = rect.right - menuRect.width;
      }

      // تحقق من الحواف
      if (left < margin) left = margin;
      if (left + menuRect.width > window.innerWidth - margin) {
        left = window.innerWidth - menuRect.width - margin;
      }
      if (top < margin) {
        top = rect.bottom + margin;
        node.dataset.placement = 'bottom';
      }
      if (top + menuRect.height > window.innerHeight - margin) {
        top = rect.top - menuRect.height - margin;
        node.dataset.placement = 'top';
      }

      node.style.top = `${Math.max(margin, top)}px`;
      // RTL منطقي: نستخدم insetInlineStart
      node.style.left = 'auto';
      node.style.right = 'auto';
      if (document.documentElement.dir === 'rtl') {
        node.style.right = `${Math.max(margin, window.innerWidth - left - menuRect.width)}px`;
      } else {
        node.style.left = `${Math.max(margin, left)}px`;
      }
    };

    // ضع أولاً بلا عرض لقياس
    node.style.visibility = 'hidden';
    portal.appendChild(node);
    position();
    node.style.visibility = '';

    // أعد الموضع عند تغيّر الحجم أو التمرير
    const reposition = () => position();
    window.addEventListener('resize', reposition, { passive: true });
    window.addEventListener('scroll', reposition, { passive: true, capture: true });

    return open({
      id,
      kind: 'menu',
      node,
      portal,
      opts: {
        lockScroll: false,
        closeOnEsc: true,
        trapFocus: false,
        autoFocus: true,
        restoreFocus: true,
        initialFocus: 'button.k-menu__item:not([disabled])',
        onClosed: () => {
          window.removeEventListener('resize', reposition, true);
          window.removeEventListener('scroll', reposition, true);
          if (typeof opts.onClosed === 'function') K.utils.tryCatch(() => opts.onClosed());
        },
      },
    });
  };


  /* ═══════════════════════════════════════════════════════════
     التلميح (Tooltip)
     ═══════════════════════════════════════════════════════════ */

  let tooltipEl = null;
  let tooltipTimer = null;

  const showTooltip = (anchor, text, placement = 'top') => {
    hideTooltip();

    if (!anchor || !text) return;

    tooltipEl = K.dom.el('div', {
      cls: 'k-tooltip',
      attrs: { role: 'tooltip' },
      data: { placement },
      text,
    });

    document.body.appendChild(tooltipEl);

    const rect = anchor.getBoundingClientRect();
    const tip = tooltipEl.getBoundingClientRect();
    const margin = 8;

    let top, left;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    if (placement === 'top') {
      top = rect.top - tip.height - margin;
      left = centerX - tip.width / 2;
    } else if (placement === 'bottom') {
      top = rect.bottom + margin;
      left = centerX - tip.width / 2;
    } else if (placement === 'start') {
      top = centerY - tip.height / 2;
      left = rect.left - tip.width - margin;
    } else {
      top = centerY - tip.height / 2;
      left = rect.right + margin;
    }

    // تحقق من الحواف
    if (left < margin) left = margin;
    if (left + tip.width > window.innerWidth - margin) {
      left = window.innerWidth - tip.width - margin;
    }
    if (top < margin) top = rect.bottom + margin;
    if (top + tip.height > window.innerHeight - margin) {
      top = rect.top - tip.height - margin;
    }

    tooltipEl.style.top = `${top}px`;
    tooltipEl.style.left = `${left}px`;
  };

  const hideTooltip = () => {
    if (tooltipTimer) { clearTimeout(tooltipTimer); tooltipTimer = null; }
    if (tooltipEl) {
      K.dom.remove(tooltipEl);
      tooltipEl = null;
    }
  };

  /**
   * يربط tooltip بعنصر.
   * @param {Element} el
   * @param {string} text
   * @param {object} [opts]
   * @param {string} [opts.placement='top']
   * @param {number} [opts.delay=400]
   */
  const bindTooltip = (el, text, opts = {}) => {
    if (!el || !text) return () => {};
    const delay = opts.delay ?? 400;
    const placement = opts.placement || 'top';

    const show = () => {
      tooltipTimer = setTimeout(() => showTooltip(el, text, placement), delay);
    };
    const hide = () => hideTooltip();

    el.addEventListener('mouseenter', show);
    el.addEventListener('mouseleave', hide);
    el.addEventListener('focus', show);
    el.addEventListener('blur', hide);

    return () => {
      el.removeEventListener('mouseenter', show);
      el.removeEventListener('mouseleave', hide);
      el.removeEventListener('focus', show);
      el.removeEventListener('blur', hide);
      hideTooltip();
    };
  };


  /* ═══════════════════════════════════════════════════════════
     الإشعار الطائر (Toast)
     ═══════════════════════════════════════════════════════════ */

  let toaster = null;
  const toastQueue = [];
  let toastSeq = 0;

  const getToaster = () => {
    if (toaster && document.contains(toaster)) return toaster;
    toaster = K.dom.el('div', {
      cls: 'k-toaster',
      attrs: { 'aria-live': 'polite', 'aria-atomic': 'false' },
    });
    document.body.appendChild(toaster);
    return toaster;
  };

  /**
   * يظهر إشعاراً طائراً.
   * @param {object} opts
   * @param {'info'|'success'|'warning'|'error'} [opts.type='info']
   * @param {string} [opts.title]
   * @param {string} [opts.message]
   * @param {number} [opts.duration=3500]  ms · 0 = دائم
   * @param {string} [opts.actionLabel]
   * @param {Function} [opts.onAction]
   * @param {boolean} [opts.dismissible=true]
   * @returns {{id, dismiss: Function}}
   */
  const toast = (opts = {}) => {
    const id = `toast_${++toastSeq}`;
    const type = opts.type || 'info';
    const duration = opts.duration ?? 3500;

    const iconName = type === 'success' ? 'check-circle'
      : type === 'warning' ? 'warning'
      : type === 'error' ? 'warning-octagon'
      : 'info';

    const node = K.dom.el('div', {
      cls: `k-toast k-toast--${type}`,
      attrs: { role: 'status', 'data-toast-id': id },
    });

    const icon = K.dom.el('span', { cls: 'k-toast__icon' });
    icon.appendChild(K.icons.get(iconName, { size: 20, stroke: 1.75 }));
    node.appendChild(icon);

    const body = K.dom.el('div', { cls: 'k-toast__body' });
    if (opts.title) {
      body.appendChild(K.dom.el('div', { cls: 'k-toast__title', text: opts.title }));
    }
    if (opts.message) {
      body.appendChild(K.dom.el('div', { cls: 'k-toast__message', text: opts.message }));
    }
    node.appendChild(body);

    if (opts.actionLabel) {
      const action = K.dom.el('button', {
        cls: 'k-toast__action',
        attrs: { type: 'button' },
        text: opts.actionLabel,
      });
      action.addEventListener('click', () => {
        if (typeof opts.onAction === 'function') {
          K.utils.tryCatch(() => opts.onAction());
        }
        dismiss();
      });
      node.appendChild(action);
    }

    let dismissTimer = null;
    let dismissed = false;

    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      if (dismissTimer) clearTimeout(dismissTimer);
      node.dataset.closing = 'true';
      const wait = K.support.reducedMotion ? 0 : 220;
      setTimeout(() => {
        K.dom.remove(node);
        const idx = toastQueue.findIndex(t => t.id === id);
        if (idx !== -1) toastQueue.splice(idx, 1);
      }, wait);
    };

    if (opts.dismissible !== false) {
      const close = K.dom.el('button', {
        cls: 'k-toast__close',
        attrs: { type: 'button', 'aria-label': 'إغلاق' },
      });
      close.appendChild(K.icons.get('x', { size: 14 }));
      close.addEventListener('click', dismiss);
      node.appendChild(close);
    }

    // حد أقصى 3 toasts معاً
    while (toastQueue.length >= 3) {
      const oldest = toastQueue[0];
      if (oldest?.dismiss) oldest.dismiss();
      else toastQueue.shift();
    }

    getToaster().appendChild(node);

    const entry = { id, node, dismiss };
    toastQueue.push(entry);

    if (duration > 0) {
      dismissTimer = setTimeout(dismiss, duration);
    }

    return entry;
  };

  const dismissAllToasts = () => {
    const copy = toastQueue.slice();
    for (const t of copy) t.dismiss();
  };


  /* ═══════════════════════════════════════════════════════════
     شارات شريط التنقّل
     ═══════════════════════════════════════════════════════════ */

  const setTabbarBadge = (section, count) => {
    const tabbar = document.querySelector('.k-tabbar');
    if (!tabbar) return;
    const item = tabbar.querySelector(`[data-section="${section}"]`);
    if (!item) return;

    let badge = item.querySelector('.k-tabbar__badge');

    if (!count || count <= 0) {
      if (badge) badge.remove();
      return;
    }

    if (!badge) {
      badge = K.dom.el('span', {
        cls: 'k-tabbar__badge',
        attrs: { 'aria-hidden': 'true' },
      });
      item.appendChild(badge);
    }

    if (count > 99) {
      badge.textContent = '99+';
    } else {
      badge.textContent = K.format.num(count);
    }
  };


  /* ═══════════════════════════════════════════════════════════
     اختصارات جاهزة
     ═══════════════════════════════════════════════════════════ */

  /** نافذة "شارك" */
  const shareModal = (post) => {
    if (!post) return;

    const options = [
      { label: 'نسخ الرابط', icon: 'link', action: 'copy-link' },
      { label: 'نسخ البرومبت', icon: 'code', action: 'copy-prompt' },
      { label: 'مشاركة عبر…', icon: 'share-network', action: 'native' },
    ];

    const body = K.dom.el('div', {
      attrs: { style: 'display:flex;flex-direction:column;gap:6px;' },
    });

    for (const opt of options) {
      const btn = K.dom.el('button', {
        cls: 'k-menu__item',
        attrs: { type: 'button' },
        style: { padding: '14px 12px' },
      });
      btn.appendChild(K.icons.get(opt.icon, { size: 20 }));
      btn.appendChild(K.dom.el('span', { text: opt.label }));

      btn.addEventListener('click', async () => {
        closeAll('modal');

        if (opt.action === 'copy-link') {
          const url = `${location.origin}/#/post/${post.id}`;
          const ok = await K.utils.copy(url);
          if (ok) {
            K.sound.success();
            toast({ type: 'success', title: 'نُسخ الرابط', duration: 1800 });
          } else {
            toast({ type: 'error', title: 'تعذّر النسخ' });
          }
        } else if (opt.action === 'copy-prompt') {
          K.actions.copyPrompt(post.id, post.prompt);
        } else if (opt.action === 'native') {
          if (navigator.share) {
            try {
              await navigator.share({
                title: post.title,
                text: post.prompt,
                url: `${location.origin}/#/post/${post.id}`,
              });
            } catch (err) {
              // المستخدم ألغى — تجاهل
            }
          } else {
            toast({ type: 'info', title: 'المشاركة غير مدعومة على هذا الجهاز' });
          }
        }
      });

      body.appendChild(btn);
    }

    modal({
      title: 'شارك المنشور',
      size: 'sm',
      body,
    });
  };

  /** نافذة "إبلاغ" */
  const reportModal = (target) => {
    if (!target?.id) return;

    const reasons = [
      { key: 'spam', label: 'محتوى دعائي متكرر' },
      { key: 'harassment', label: 'تحرّش أو إساءة' },
      { key: 'hate', label: 'خطاب كراهية' },
      { key: 'violence', label: 'عنف أو تهديد' },
      { key: 'sexual', label: 'محتوى غير لائق' },
      { key: 'misinformation', label: 'معلومات مضلّلة' },
      { key: 'copyright', label: 'انتهاك حقوق' },
      { key: 'impersonation', label: 'انتحال شخصية' },
      { key: 'other', label: 'سبب آخر' },
    ];

    let selectedReason = null;
    let note = '';

    const body = K.dom.el('div', {
      attrs: { style: 'display:flex;flex-direction:column;gap:16px;' },
    });

    // الخيارات
    const options = K.dom.el('div', {
      attrs: { style: 'display:flex;flex-direction:column;gap:6px;' },
      role: 'radiogroup',
    });

    for (const r of reasons) {
      const label = K.dom.el('label', {
        cls: 'k-option',
        attrs: { role: 'radio', 'aria-checked': 'false' },
      });
      label.dataset.reason = r.key;

      const dot = K.dom.el('div', { cls: 'k-option__check' });
      const text = K.dom.el('div', { cls: 'k-option__title', text: r.label });

      label.appendChild(text);
      label.appendChild(dot);

      label.addEventListener('click', () => {
        for (const other of options.children) {
          other.dataset.active = 'false';
          other.setAttribute('aria-checked', 'false');
        }
        label.dataset.active = 'true';
        label.setAttribute('aria-checked', 'true');
        selectedReason = r.key;
      });

      options.appendChild(label);
    }
    body.appendChild(options);

    // ملاحظة إضافية
    const noteField = K.dom.el('div', { cls: 'k-textarea' });
    const noteInput = K.dom.el('textarea', {
      cls: 'k-textarea__field',
      attrs: { rows: '3', maxLength: '500', placeholder: 'تفاصيل إضافية (اختياري)' },
    });
    noteInput.style.minHeight = '72px';
    noteInput.addEventListener('input', () => { note = noteInput.value; });
    noteField.appendChild(noteInput);
    body.appendChild(noteField);

    modal({
      title: 'إبلاغ عن المحتوى',
      subtitle: 'سيراجع الفريق بلاغك خلال 24 ساعة',
      size: 'sm',
      body,
      actions: [
        { label: 'إلغاء', variant: 'secondary' },
        {
          label: 'إرسال البلاغ',
          variant: 'danger',
          onClick: async () => {
            if (!selectedReason) {
              K.overlays.toast({
                type: 'warning',
                title: 'اختر سبباً للإبلاغ',
                duration: 2500,
              });
              return false;
            }
            try {
              await K.actions.report({
                type: target.type || 'post',
                id: target.id,
                reason: selectedReason,
                note,
              });
              return true;
            } catch {
              return false;
            }
          },
        },
      ],
    });
  };


  /* ═══════════════════════════════════════════════════════════
     التهيئة
     ═══════════════════════════════════════════════════════════ */

  const init = () => {
    attachBackHandler();

    // مراقبة التمرير لإعادة موضعة القوائم المفتوحة
    K.events.on(window, 'resize', () => {
      for (const entry of stack) {
        if (entry.kind === 'menu' || entry.kind === 'tooltip') {
          // يُعاد موضعها عبر مستمعيها الداخليين
        }
      }
    }, { passive: true });

    // اختصارات لوحة المفاتيح
    K.events.on(document, 'keydown', (evt) => {
      // Ctrl/Cmd+K → بحث
      if ((evt.ctrlKey || evt.metaKey) && evt.key.toLowerCase() === 'k') {
        if (K.session?.isAuthenticated) {
          evt.preventDefault();
          K.router.go('/search');
        }
      }
      // "/" → بحث سريع (بلا تركيز في حقل)
      if (evt.key === '/' &&
          !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) &&
          K.session?.isAuthenticated) {
        evt.preventDefault();
        K.router.go('/search');
      }
    }, false);

    // إغلاق كل شيء عند تسجيل الخروج
    K.store.subscribe('authStatus', (status) => {
      if (status === 'guest') {
        closeAll('modal');
        closeAll('drawer');
        closeAll('menu');
      }
    });

    // تنظيف عند إغلاق الصفحة
    window.addEventListener('pagehide', () => {
      dismissAllToasts();
      hideTooltip();
    }, { passive: true });
  };


  /* ═══════════════════════════════════════════════════════════
     التصدير
     ═══════════════════════════════════════════════════════════ */

  K.overlays = {
    init,
    // الفتح
    modal,
    confirm,
    drawer,
    menu,
    toast,
    // التلميح
    showTooltip,
    hideTooltip,
    bindTooltip,
    // الإغلاق
    close,
    closeTop,
    closeAll,
    dismissAllToasts,
    // الشارات
    setTabbarBadge,
    // مختصرات
    shareModal,
    reportModal,
    // حالة
    hasOpen,
    isOpen,
    get stack() { return stack.slice(); },
    get topId() { return findTop()?.id || null; },
  };

  /* نهاية 09-overlays.js */
})();