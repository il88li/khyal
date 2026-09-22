/* ============================================================
   خَيال · 10-app · نقطة التمهيد
   تربط كل الطبقات السابقة · تسجّل المسارات · تركّب الشاشات
   تُحمَّل أخيراً في index.html
   ============================================================ */

'use strict';

(function () {
  const K = window.K;
  if (!K) { console.error('[app] النواة غير محمّلة'); return; }

  /* ═══════════════════════════════════════════════════════════
     مرجع للعرض الحالي
     ═══════════════════════════════════════════════════════════ */

  const runtime = {
    viewport: null,       // حاوية الشاشات
    screen: null,         // الشاشة الحالية
    controller: null,     // AbortController للشاشة الحالية
    cleanupFns: [],       // دوال التنظيف عند تغيير الشاشة
  };

  /* ═══════════════════════════════════════════════════════════
     تحميل قوالب HTML مسبقاً — مرة واحدة
     ═══════════════════════════════════════════════════════════ */

  const templateCache = new Map();

  const loadTemplate = async (name) => {
    if (templateCache.has(name)) return templateCache.get(name);

    const promise = fetch(`/views/${name}.html`, { cache: 'force-cache' })
      .then(r => {
        if (!r.ok) throw new Error(`تعذّر تحميل ${name}.html`);
        return r.text();
      })
      .then(text => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        const templates = {};
        doc.querySelectorAll('template[id]').forEach(t => {
          templates[t.id] = t.content;
        });
        return templates;
      });

    templateCache.set(name, promise);
    return promise;
  };

  const getTemplate = async (fileName, templateId) => {
    const templates = await loadTemplate(fileName);
    const content = templates[templateId];
    if (!content) throw new Error(`قالب غير موجود: ${templateId}`);
    return content.cloneNode(true);
  };

  /* ═══════════════════════════════════════════════════════════
     إدارة الشاشة الحالية — دخول · خروج · تنظيف
     ═══════════════════════════════════════════════════════════ */

  const clearScreen = () => {
    // نفّذ كل دوال التنظيف
    for (const fn of runtime.cleanupFns) {
      K.utils.tryCatch(fn);
    }
    runtime.cleanupFns = [];

    // ألغِ كل الطلبات المعلّقة
    if (runtime.controller) {
      runtime.controller.abort();
      runtime.controller = null;
    }

    // أعطِ الشاشة القديمة حالة الخروج
    if (runtime.screen && runtime.screen.parentNode) {
      runtime.screen.dataset.state = 'exiting';
      const old = runtime.screen;
      const wait = K.support.reducedMotion ? 0 : 200;
      setTimeout(() => K.dom.remove(old), wait);
    }

    runtime.screen = null;
  };

  const registerCleanup = (fn) => {
    if (typeof fn === 'function') runtime.cleanupFns.push(fn);
  };

  /**
   * تركّب شاشة جديدة.
   * @param {Node} content     جذر الشاشة (يُصبح .k-screen)
   * @param {object} [opts]
   * @param {string} [opts.transition='default']  'default' | 'push' | 'pop'
   * @param {boolean} [opts.hasTabbar=true]
   */
  const mountScreen = (content, opts = {}) => {
    clearScreen();

    const screen = K.dom.el('div', {
      cls: 'k-screen',
      attrs: { role: 'main', id: 'khayal-screen' },
      data: { transition: opts.transition || 'default', hasTabbar: opts.hasTabbar === false ? 'false' : 'true' },
    });

    // غلّف المحتوى في منطقة آمنة
    const inner = K.dom.el('div', { cls: 'k-screen__content' });
    if (content instanceof Node) inner.appendChild(content);
    else if (Array.isArray(content)) content.forEach(c => c && inner.appendChild(c));

    screen.appendChild(inner);
    runtime.viewport.appendChild(screen);

    runtime.screen = screen;
    runtime.controller = new AbortController();

    // مرّر للأعلى
    K.raf.write(() => { screen.scrollTop = 0; });

    return screen;
  };

  /* ═══════════════════════════════════════════════════════════
     مكوّنات جاهزة — بناء بطاقة منشور
     ═══════════════════════════════════════════════════════════ */

  const buildPostCard = (post, opts = {}) => {
    if (!post) return null;

    const variant = opts.variant || 'default';   // 'default' | 'compact' | 'grid'
    const card = K.dom.el('article', {
      cls: `k-post${variant !== 'default' ? ` k-post--${variant}` : ''}`,
      attrs: { 'aria-labelledby': `post-${post.id}-title` },
      data: { postId: post.id },
    });

    /* ---- منطقة الصورة ---- */
    const media = K.dom.el('div', {
      cls: 'k-post__media',
      attrs: { role: 'button', tabindex: '0', 'aria-label': `افتح منشور: ${post.title}` },
    });

    if (post.cover) {
      const img = K.dom.el('img', {
        cls: 'k-post__image',
        attrs: {
          src: post.cover,
          alt: post.title,
          loading: 'lazy',
          decoding: 'async',
        },
      });
      media.appendChild(img);
    } else {
      // بديل خفيف
      media.style.background = 'var(--k-surface-sunken)';
      media.appendChild(K.dom.el('div', {
        cls: 'k-skeleton',
        attrs: { style: 'width:100%;height:100%;' },
      }));
    }

    // شريط الموديل العائم
    if (post.model) {
      const model = K.dom.el('div', { cls: 'k-post__model' });
      model.appendChild(K.icons.get('sparkle', { size: 12, stroke: 2 }));
      model.appendChild(K.dom.el('span', { text: post.model }));
      media.appendChild(model);
    }

    // أزرار عائمة
    const floatActions = K.dom.el('div', {
      cls: 'k-post__float-actions',
      attrs: { role: 'group', 'aria-label': 'إجراءات سريعة' },
    });

    const saveFloatBtn = K.dom.el('button', {
      cls: 'k-post__float-btn',
      attrs: {
        type: 'button',
        'aria-label': post.viewer?.saved ? 'إزالة الحفظ' : 'حفظ',
        'data-saved': post.viewer?.saved ? 'true' : 'false',
      },
    });
    saveFloatBtn.appendChild(K.icons.get('bookmark-simple', { size: 16, stroke: 1.5 }));
    saveFloatBtn.addEventListener('click', (evt) => {
      K.events.stop(evt);
      handleToggleSave(post, saveFloatBtn);
    });
    floatActions.appendChild(saveFloatBtn);

    const shareFloatBtn = K.dom.el('button', {
      cls: 'k-post__float-btn',
      attrs: { type: 'button', 'aria-label': 'مشاركة' },
    });
    shareFloatBtn.appendChild(K.icons.get('share-network', { size: 16, stroke: 1.5 }));
    shareFloatBtn.addEventListener('click', (evt) => {
      K.events.stop(evt);
      K.overlays.shareModal(post);
    });
    floatActions.appendChild(shareFloatBtn);

    media.appendChild(floatActions);

    // نسخة الشبكة — overlay
    if (variant === 'grid') {
      const overlay = K.dom.el('div', { cls: 'k-post__overlay' });
      const stats = K.dom.el('div', { cls: 'k-post__overlay-stats' });
      const likeStat = K.dom.el('span');
      likeStat.appendChild(K.icons.get('heart', { size: 14, stroke: 2 }));
      likeStat.appendChild(K.dom.el('span', { text: K.format.compact(post.stats?.likes || 0) }));
      stats.appendChild(likeStat);
      const saveStat = K.dom.el('span');
      saveStat.appendChild(K.icons.get('bookmark-simple', { size: 14, stroke: 2 }));
      saveStat.appendChild(K.dom.el('span', { text: K.format.compact(post.stats?.saves || 0) }));
      stats.appendChild(saveStat);
      overlay.appendChild(stats);
      media.appendChild(overlay);
    }

    // نقر على الصورة → التفاصيل
    const openDetail = (evt) => {
      if (evt?.target?.closest('button')) return;
      K.router.go(`/post/${post.id}`);
    };
    media.addEventListener('click', openDetail);
    media.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter' || evt.key === ' ') {
        evt.preventDefault();
        openDetail(evt);
      }
    });

    card.appendChild(media);

    /* ---- نسخة الشبكة تُخفي الجسم ---- */
    if (variant === 'grid') return card;

    /* ---- جسم البطاقة ---- */
    const body = K.dom.el('div', { cls: 'k-post__body' });

    // المؤلف
    if (post.author) {
      const author = K.dom.el('div', {
        cls: 'k-post__author',
        attrs: { role: 'button', tabindex: '0', 'aria-label': `افتح ملف ${post.author.displayName}` },
      });

      const avatar = K.dom.el('div', {
        cls: `k-avatar k-avatar--sm k-avatar--${variant === 'compact' ? 'xs' : 'sm'}`,
      });
      if (post.author.avatar) {
        avatar.appendChild(K.dom.el('img', {
          attrs: { src: post.author.avatar, alt: '', loading: 'lazy' },
        }));
      } else {
        avatar.appendChild(K.dom.el('span', {
          cls: 'k-avatar__fallback',
          text: post.author.displayName?.[0] || 'خ',
        }));
      }
      author.appendChild(avatar);

      const info = K.dom.el('div', { cls: 'k-post__author-info' });
      const nameRow = K.dom.el('div', { cls: 'k-post__author-name' });
      nameRow.textContent = post.author.displayName;
      if (post.author.verified) {
        nameRow.appendChild(K.dom.el('span', { attrs: { style: 'display:inline-flex;margin-inline-start:4px;color:var(--k-brand-500);' } }));
        const v = nameRow.lastChild;
        v.appendChild(K.icons.get('seal-check', { size: 12, stroke: 2 }));
      }
      info.appendChild(nameRow);
      info.appendChild(K.dom.el('div', {
        cls: 'k-post__author-meta',
        text: `${K.format.since(post.createdAt)} · @${post.author.handle}`,
      }));
      author.appendChild(info);

      const menuBtn = K.dom.el('button', {
        cls: 'k-post__menu-btn',
        attrs: { type: 'button', 'aria-label': 'خيارات' },
      });
      menuBtn.appendChild(K.icons.get('dots-three', { size: 18 }));
      menuBtn.addEventListener('click', (evt) => {
        K.events.stop(evt);
        openPostMenu(post, menuBtn);
      });
      author.appendChild(menuBtn);

      author.addEventListener('click', (evt) => {
        if (evt.target.closest('button')) return;
        K.router.go(`/u/${post.author.handle}`);
      });

      body.appendChild(author);
    }

    // العنوان
    if (post.title) {
      const title = K.dom.el('h3', {
        cls: 'k-post__title',
        text: post.title,
        attrs: { id: `post-${post.id}-title` },
      });
      title.addEventListener('click', () => K.router.go(`/post/${post.id}`));
      body.appendChild(title);
    }

    // مقتطف البرومبت
    if (post.prompt && variant !== 'compact') {
      const prompt = K.dom.el('div', { cls: 'k-post__prompt' });
      prompt.appendChild(K.dom.el('span', {
        cls: 'k-post__prompt-text',
        text: post.prompt,
      }));

      const copyBtn = K.dom.el('button', {
        cls: 'k-post__prompt-copy',
        attrs: { type: 'button', 'aria-label': 'نسخ البرومبت' },
      });
      copyBtn.appendChild(K.icons.get('copy', { size: 14, stroke: 1.75 }));
      copyBtn.addEventListener('click', async (evt) => {
        K.events.stop(evt);
        await K.actions.copyPrompt(post.id, post.prompt);
        copyBtn.dataset.copied = 'true';
        setTimeout(() => { delete copyBtn.dataset.copied; }, 1500);
      });
      prompt.appendChild(copyBtn);

      body.appendChild(prompt);
    }

    // الوسوم
    if (post.tags?.length && variant !== 'compact') {
      const tagsWrap = K.dom.el('div', { cls: 'k-post__tags' });
      const maxTags = 4;
      const shown = post.tags.slice(0, maxTags);

      for (const tag of shown) {
        const tagEl = K.dom.el('button', {
          cls: 'k-post__tag',
          attrs: { type: 'button', 'aria-label': `تصفّح وسم ${tag}` },
          text: `#${tag}`,
        });
        tagEl.addEventListener('click', (evt) => {
          K.events.stop(evt);
          K.router.go(`/tag/${tag}`);
        });
        tagsWrap.appendChild(tagEl);
      }

      if (post.tags.length > maxTags) {
        tagsWrap.appendChild(K.dom.el('span', {
          cls: 'k-post__tag-more',
          text: `+${post.tags.length - maxTags}`,
        }));
      }
      body.appendChild(tagsWrap);
    }

    // شريط التفاعل
    const actions = K.dom.el('div', {
      cls: 'k-post__actions',
      attrs: { role: 'group', 'aria-label': 'تفاعلات' },
    });

    // إعجاب
    const likeBtn = K.dom.el('button', {
      cls: 'k-post__action',
      attrs: {
        type: 'button',
        'aria-label': post.viewer?.liked ? 'إلغاء الإعجاب' : 'إعجاب',
        'aria-pressed': post.viewer?.liked ? 'true' : 'false',
        'data-liked': post.viewer?.liked ? 'true' : 'false',
      },
    });
    likeBtn.appendChild(K.icons.get('heart', { size: 18, stroke: 1.5 }));
    likeBtn.appendChild(K.dom.el('span', {
      text: K.format.compact(post.stats?.likes || 0),
    }));
    likeBtn.addEventListener('click', async (evt) => {
      K.events.stop(evt);
      await handleToggleLike(post, likeBtn);
    });
    actions.appendChild(likeBtn);

    // تعليقات
    const commentBtn = K.dom.el('button', {
      cls: 'k-post__action',
      attrs: { type: 'button', 'aria-label': `${post.stats?.comments || 0} تعليق` },
    });
    commentBtn.appendChild(K.icons.get('chat-circle', { size: 18, stroke: 1.5 }));
    commentBtn.appendChild(K.dom.el('span', {
      text: K.format.compact(post.stats?.comments || 0),
    }));
    commentBtn.addEventListener('click', (evt) => {
      K.events.stop(evt);
      K.router.go(`/post/${post.id}#comments`);
    });
    actions.appendChild(commentBtn);

    actions.appendChild(K.dom.el('div', { cls: 'k-post__actions-spacer' }));

    // نسخ
    const copyActBtn = K.dom.el('button', {
      cls: 'k-post__action k-post__share',
      attrs: { type: 'button', 'aria-label': 'نسخ البرومبت' },
    });
    copyActBtn.appendChild(K.icons.get('copy', { size: 18, stroke: 1.5 }));
    copyActBtn.addEventListener('click', async (evt) => {
      K.events.stop(evt);
      await K.actions.copyPrompt(post.id, post.prompt);
    });
    actions.appendChild(copyActBtn);

    // حفظ
    const saveBtn = K.dom.el('button', {
      cls: 'k-post__action',
      attrs: {
        type: 'button',
        'aria-label': post.viewer?.saved ? 'إزالة الحفظ' : 'حفظ',
        'data-saved': post.viewer?.saved ? 'true' : 'false',
      },
    });
    saveBtn.appendChild(K.icons.get('bookmark-simple', { size: 18, stroke: 1.5 }));
    saveBtn.addEventListener('click', async (evt) => {
      K.events.stop(evt);
      await handleToggleSave(post, saveBtn);
    });
    actions.appendChild(saveBtn);

    body.appendChild(actions);
    card.appendChild(body);

    return card;
  };

  /* ---- معالجات تفاعل البطاقة ---- */

  const handleToggleLike = async (post, btn) => {
    try {
      const liked = await K.actions.toggleLike(post.id);
      // حدّث DOM إن كان الزر نفسه
      const newPost = K.content.getPost(post.id);
      if (!newPost) return;
      if (liked !== undefined) {
        btn.dataset.liked = liked ? 'true' : 'false';
        btn.setAttribute('aria-pressed', liked ? 'true' : 'false');
        const label = btn.querySelector('span');
        if (label) label.textContent = K.format.compact(newPost.stats?.likes || 0);
      }
    } catch { /* معالَج داخل actions */ }
  };

  const handleToggleSave = async (post, btn) => {
    try {
      const saved = await K.actions.toggleSave(post.id);
      if (saved !== undefined) {
        btn.dataset.saved = saved ? 'true' : 'false';
      }
    } catch { /* معالَج */ }
  };

  const openPostMenu = (post, anchor) => {
    const me = K.store.get('user');
    const isAuthor = me?.id === post.author?.id;

    const items = [
      {
        label: 'حفظ في المكتبة',
        icon: 'bookmark-simple',
        onClick: () => K.actions.toggleSave(post.id),
      },
      {
        label: 'نسخ البرومبت',
        icon: 'copy',
        onClick: () => K.actions.copyPrompt(post.id, post.prompt),
      },
      {
        label: 'مشاركة',
        icon: 'share-network',
        onClick: () => K.overlays.shareModal(post),
      },
    ];

    if (isAuthor) {
      items.push({ divider: true });
      items.push({
        label: 'تحرير المنشور',
        icon: 'pencil-simple',
        onClick: () => K.router.go(`/post/${post.id}/edit`),
      });
      items.push({
        label: 'حذف المنشور',
        icon: 'trash',
        danger: true,
        onClick: async () => {
          const ok = await K.overlays.confirm({
            title: 'حذف المنشور؟',
            message: 'لا يمكن التراجع عن هذا الإجراء.',
            variant: 'danger',
            confirmLabel: 'احذف',
            destructive: true,
          });
          if (ok) {
            try {
              await K.actions.deletePost(post.id);
              // أزل البطاقة من DOM
              const card = anchor.closest('.k-post');
              if (card) {
                card.style.transition = 'opacity 200ms ease';
                card.style.opacity = '0';
                setTimeout(() => K.dom.remove(card), 200);
              }
            } catch { /* معالَج */ }
          }
        },
      });
    } else {
      items.push({ divider: true });
      items.push({
        label: 'إبلاغ عن المحتوى',
        icon: 'flag',
        danger: true,
        onClick: () => K.overlays.reportModal({ type: 'post', id: post.id }),
      });
    }

    K.overlays.menu({ anchor, items });
  };

  /* ═══════════════════════════════════════════════════════════
     مكوّن مستخدم جاهز
     ═══════════════════════════════════════════════════════════ */

  const buildUserCard = (user, opts = {}) => {
    if (!user) return null;

    const card = K.dom.el('div', {
      cls: `k-user${opts.variant ? ` k-user--${opts.variant}` : ''}`,
      attrs: { role: 'button', tabindex: '0' },
    });

    const avatar = K.dom.el('div', {
      cls: `k-avatar k-avatar--${opts.avatarSize || 'md'}`,
    });
    if (user.avatar) {
      avatar.appendChild(K.dom.el('img', {
        attrs: { src: user.avatar, alt: '', loading: 'lazy' },
      }));
    } else {
      avatar.appendChild(K.dom.el('span', {
        cls: 'k-avatar__fallback',
        text: user.displayName?.[0] || 'خ',
      }));
    }
    card.appendChild(avatar);

    const info = K.dom.el('div', { cls: 'k-user__info' });
    const nameRow = K.dom.el('div', { cls: 'k-user__name' });
    nameRow.appendChild(K.dom.el('span', { text: user.displayName }));
    if (user.verified) {
      const v = K.dom.el('span', { cls: 'k-user__verified' });
      v.appendChild(K.icons.get('seal-check', { size: 14, stroke: 1.75 }));
      nameRow.appendChild(v);
    }
    info.appendChild(nameRow);
    info.appendChild(K.dom.el('div', {
      cls: 'k-user__handle',
      text: `@${user.handle}`,
    }));
    if (user.bio && opts.variant !== 'compact') {
      info.appendChild(K.dom.el('div', { cls: 'k-user__bio', text: user.bio }));
    }
    card.appendChild(info);

    // زر متابعة
    const me = K.store.get('user');
    if (opts.followButton !== false && user.id !== me?.id) {
      const following = !!user.relation?.isFollowing;
      const btn = K.dom.el('button', {
        cls: `k-btn k-btn--sm k-btn--${following ? 'secondary' : 'primary'}`,
        attrs: {
          type: 'button',
          'aria-label': following ? 'إلغاء المتابعة' : 'متابعة',
        },
        text: following ? 'متابع' : 'متابعة',
      });
      btn.dataset.following = following ? 'true' : 'false';

      btn.addEventListener('click', async (evt) => {
        K.events.stop(evt);
        try {
          const nowFollowing = await K.actions.toggleFollow(user);
          if (nowFollowing !== undefined) {
            btn.dataset.following = nowFollowing ? 'true' : 'false';
            btn.textContent = nowFollowing ? 'متابع' : 'متابعة';
            btn.classList.toggle('k-btn--secondary', nowFollowing);
            btn.classList.toggle('k-btn--primary', !nowFollowing);
          }
        } catch { /* معالَج */ }
      });

      const action = K.dom.el('div', { cls: 'k-user__action' });
      action.appendChild(btn);
      card.appendChild(action);
    }

    card.addEventListener('click', (evt) => {
      if (evt.target.closest('button')) return;
      K.router.go(`/u/${user.handle}`);
    });

    return card;
  };

  /* ═══════════════════════════════════════════════════════════
     بناء شاشة البطل — للترحيبية
     ═══════════════════════════════════════════════════════════ */

  const buildWelcomeScreen = async () => {
    const tpl = await getTemplate('landing', 'landing-screen');
    const root = tpl;

    // مؤشرات الثقة
    const trustValues = root.querySelectorAll('[data-trust-value]');
    trustValues.forEach(el => {
      const key = el.dataset.trustValue;
      const n = parseInt(el.dataset.trustCount || '0', 10);
      animateNumber(el, 0, n, 1200);
    });

    // CTA رئيسي
    const signupBtn = root.querySelector('[data-action="signup"]');
    if (signupBtn) {
      signupBtn.addEventListener('click', () => K.router.go('/signup'));
    }
    const loginBtn = root.querySelector('[data-action="login"]');
    if (loginBtn) {
      loginBtn.addEventListener('click', () => K.router.go('/login'));
    }
    const browseBtn = root.querySelector('[data-action="browse"]');
    if (browseBtn) {
      browseBtn.addEventListener('click', () => K.router.go('/explore'));
    }

    return root;
  };

  /** عدّاد متحرك لنص */
  const animateNumber = (el, from, to, duration) => {
    if (K.support.reducedMotion) {
      el.textContent = K.format.compact(to);
      return;
    }
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = Math.floor(from + (to - from) * eased);
      el.textContent = K.format.compact(val);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  /* ═══════════════════════════════════════════════════════════
     بناء شاشة تغذية عامة (home · explore · likes · saved · profile)
     ═══════════════════════════════════════════════════════════ */

  const buildFeedScreen = async (opts) => {
    const {
      feedKey,
      title,
      subtitle,
      hasTabbar = true,
      showComposer = false,
      showSortbar = true,
      showFilterbar = false,
      appendAfter = null,
      empty = {},
    } = opts;

    const wrapper = K.dom.el('div', { attrs: { style: 'display:flex;flex-direction:column;min-height:100%;' } });

    // الترويسة
    const header = K.dom.el('header');
    header.style.cssText = 'padding: var(--k-space-5) var(--k-space-4) var(--k-space-3);';
    if (title) {
      header.appendChild(K.dom.el('h1', {
        attrs: { style: 'font-family:var(--k-font-display);font-size:var(--k-fs-2xl);font-weight:700;letter-spacing:-0.02em;margin:0;color:var(--k-text-primary);' },
        text: title,
      }));
    }
    if (subtitle) {
      header.appendChild(K.dom.el('p', {
        attrs: { style: 'margin:var(--k-space-1) 0 0;font-size:var(--k-fs-sm);color:var(--k-text-secondary);' },
        text: subtitle,
      }));
    }
    wrapper.appendChild(header);

    // محرّر النشر السريع
    if (showComposer) {
      const me = K.store.get('user');
      const composer = K.dom.el('button', {
        cls: 'k-quick-composer',
        attrs: { type: 'button', 'aria-label': 'ابدأ بنشر برومبت جديد' },
      });
      const avatar = K.dom.el('div', {
        cls: `k-avatar k-avatar--sm`,
      });
      if (me?.avatar) {
        avatar.appendChild(K.dom.el('img', {
          attrs: { src: me.avatar, alt: '', loading: 'lazy' },
        }));
      } else {
        avatar.appendChild(K.dom.el('span', {
          cls: 'k-avatar__fallback',
          text: me?.displayName?.[0] || 'خ',
        }));
      }
      composer.appendChild(avatar);
      composer.appendChild(K.dom.el('span', {
        cls: 'k-quick-composer__hint',
        text: 'شارك برومبتاً جديداً…',
      }));
      const icon = K.dom.el('span', { cls: 'k-quick-composer__icon' });
      icon.appendChild(K.icons.get('plus', { size: 18, stroke: 2 }));
      composer.appendChild(icon);
      composer.addEventListener('click', () => K.router.go('/compose'));
      wrapper.appendChild(composer);
    }

    // شريط الترتيب
    if (showSortbar) {
      const sortbar = K.dom.el('div', {
        cls: 'k-sortbar',
        attrs: { role: 'tablist', 'aria-label': 'ترتيب' },
      });

      const sorts = [
        { key: 'recent', label: 'الأحدث', icon: 'clock' },
        { key: 'trending', label: 'الأكثر رواجاً', icon: 'fire' },
        { key: 'top', label: 'الأعلى تفاعلاً', icon: 'heart' },
      ];

      const feed = K.content.getFeed(feedKey);
      const currentSort = feed?.filters?.sort || 'recent';

      for (const s of sorts) {
        const chip = K.dom.el('button', {
          cls: 'k-sortbar__chip',
          attrs: { type: 'button', role: 'tab', 'aria-selected': currentSort === s.key ? 'true' : 'false' },
          data: { sort: s.key },
        });
        chip.appendChild(K.icons.get(s.icon, { size: 14, stroke: 1.5 }));
        chip.appendChild(K.dom.el('span', { text: s.label }));
        chip.addEventListener('click', async () => {
          sortbar.querySelectorAll('.k-sortbar__chip').forEach(c => c.setAttribute('aria-selected', 'false'));
          chip.setAttribute('aria-selected', 'true');
          await K.content.applyFilters(feedKey, { sort: s.key });
          renderFeedItems(feedList, feedKey, empty);
        });
        sortbar.appendChild(chip);
      }
      wrapper.appendChild(sortbar);
    }

    // شريط الفلاتر
    if (showFilterbar) {
      const filterbar = K.dom.el('div', { cls: 'k-filterbar', attrs: { 'aria-label': 'فلاتر' } });
      filterbar.appendChild(K.dom.el('span', { cls: 'k-filterbar__label', text: 'وسوم:' }));

      const tags = ['portrait', 'landscape', 'fantasy', 'scifi', 'anime', 'architecture'];
      for (const t of tags) {
        const tagEl = K.dom.el('button', {
          cls: 'k-tag',
          attrs: { type: 'button', 'aria-label': `فلتر وسم ${t}` },
        });
        tagEl.appendChild(K.dom.el('span', { text: `#${t}` }));
        tagEl.addEventListener('click', async () => {
          const feed = K.content.getFeed(feedKey);
          const active = (feed.filters.tags || []).includes(t);
          const next = active
            ? feed.filters.tags.filter(x => x !== t)
            : [...(feed.filters.tags || []), t];
          tagEl.dataset.active = !active ? 'true' : 'false';
          await K.content.applyFilters(feedKey, { tags: next });
          renderFeedItems(feedList, feedKey, empty);
        });
        filterbar.appendChild(tagEl);
      }
      wrapper.appendChild(filterbar);
    }

    // حاوية القائمة
    const feedList = K.dom.el('div', { cls: 'k-feed', attrs: { 'aria-live': 'polite' } });
    wrapper.appendChild(feedList);

    // حلقة إضافية (لبناء إضافي)
    if (appendAfter) {
      wrapper.appendChild(appendAfter);
    }

    return { root: wrapper, feedList };
  };

  /** رسم عناصر تغذية موجودة */
  const renderFeedItems = (container, feedKey, emptyOpts = {}) => {
    K.dom.clear(container);
    const feed = K.content.getFeed(feedKey);

    if (feed.loading && !feed.items.length) {
      // هياكل
      for (let i = 0; i < 6; i++) {
        container.appendChild(buildPostSkeleton());
      }
      return;
    }

    if (feed.error && !feed.items.length) {
      container.appendChild(buildErrorState({
        message: feed.error.message || 'تعذّر تحميل المحتوى',
        onRetry: async () => {
          renderFeedItems(container, feedKey, emptyOpts);
          await K.content.refresh(feedKey);
          renderFeedItems(container, feedKey, emptyOpts);
        },
      }));
      return;
    }

    if (!feed.items.length) {
      container.appendChild(buildEmptyState(emptyOpts));
      return;
    }

    for (const post of feed.items) {
      const card = buildPostCard(post, { variant: 'default' });
      if (card) container.appendChild(card);
    }

    // Sentinal للتمرير اللانهائي
    if (feed.hasMore) {
      const sentinel = K.dom.el('div', {
        cls: 'k-feed__loader',
        attrs: { 'aria-hidden': 'true' },
      });
      sentinel.style.gridColumn = '1 / -1';
      sentinel.style.height = '1px';
      container.appendChild(sentinel);

      const loaderLabel = K.dom.el('div', { cls: 'k-feed__loader' });
      loaderLabel.style.gridColumn = '1 / -1';
      const spinner = K.dom.el('span', { cls: 'k-spinner k-spinner--sm k-spinner--neutral' });
      loaderLabel.appendChild(spinner);
      loaderLabel.appendChild(K.dom.el('span', { text: 'جارٍ تحميل المزيد' }));
      container.appendChild(loaderLabel);

      const scroll = K.content.attachInfiniteScroll(sentinel, feedKey, {
        onLoad: () => {
          // استبدل عناصر جديدة
          const feed2 = K.content.getFeed(feedKey);
          K.dom.clear(container);
          for (const p of feed2.items) {
            const c = buildPostCard(p, { variant: 'default' });
            if (c) container.appendChild(c);
          }
          if (!feed2.hasMore) {
            container.appendChild(K.dom.el('div', {
              cls: 'k-feed__end',
              text: 'وصلت إلى النهاية',
            }));
          }
        },
      });

      registerCleanup(() => scroll.detach());
    } else {
      container.appendChild(K.dom.el('div', {
        cls: 'k-feed__end',
        text: 'وصلت إلى النهاية',
      }));
    }
  };

  /* ---- حالات مشتركة ---- */

  const buildPostSkeleton = () => {
    const card = K.dom.el('div', { cls: 'k-post-skeleton' });
    card.appendChild(K.dom.el('div', { cls: 'k-skeleton k-post-skeleton__media' }));
    const row = K.dom.el('div', { cls: 'k-post-skeleton__row' });
    row.appendChild(K.dom.el('div', { cls: 'k-skeleton k-skeleton--circle k-post-skeleton__avatar' }));
    const stack = K.dom.el('div', { cls: 'k-skeleton-stack', attrs: { style: 'flex:1' } });
    stack.appendChild(K.dom.el('div', { cls: 'k-skeleton k-skeleton--text' }));
    stack.appendChild(K.dom.el('div', { cls: 'k-skeleton k-skeleton--text', attrs: { style: 'width:60%' } }));
    row.appendChild(stack);
    card.appendChild(row);
    return card;
  };

  const buildEmptyState = (opts = {}) => {
    const wrap = K.dom.el('div', { cls: 'k-empty' });
    const icon = K.dom.el('div', { cls: 'k-empty__icon' });
    icon.appendChild(K.icons.get(opts.icon || 'sparkle', { size: 36, stroke: 1.25 }));
    wrap.appendChild(icon);
    wrap.appendChild(K.dom.el('h2', {
      cls: 'k-empty__title',
      text: opts.title || 'لا يوجد شيء هنا بعد',
    }));
    if (opts.message) {
      wrap.appendChild(K.dom.el('p', {
        cls: 'k-empty__message',
        text: opts.message,
      }));
    }
    if (opts.actionLabel && opts.onAction) {
      const actions = K.dom.el('div', { cls: 'k-empty__actions' });
      const btn = K.dom.el('button', {
        cls: 'k-btn k-btn--md k-btn--primary',
        attrs: { type: 'button' },
        text: opts.actionLabel,
      });
      btn.addEventListener('click', opts.onAction);
      actions.appendChild(btn);
      wrap.appendChild(actions);
    }
    wrap.style.gridColumn = '1 / -1';
    return wrap;
  };

  const buildErrorState = (opts = {}) => {
    const wrap = K.dom.el('div', { cls: 'k-empty' });
    const icon = K.dom.el('div', {
      cls: 'k-empty__icon',
      attrs: { style: 'background:var(--k-error-50);color:var(--k-error-500);' },
    });
    icon.appendChild(K.icons.get('warning-octagon', { size: 36, stroke: 1.25 }));
    wrap.appendChild(icon);
    wrap.appendChild(K.dom.el('h2', {
      cls: 'k-empty__title',
      text: 'لم يكتمل التحميل',
    }));
    wrap.appendChild(K.dom.el('p', {
      cls: 'k-empty__message',
      text: opts.message || 'تحقق من اتصالك وحاول مجدداً',
    }));
    if (opts.onRetry) {
      const actions = K.dom.el('div', { cls: 'k-empty__actions' });
      const btn = K.dom.el('button', {
        cls: 'k-btn k-btn--md k-btn--secondary',
        attrs: { type: 'button' },
      });
      btn.appendChild(K.icons.get('arrow-clockwise', { size: 16 }));
      btn.appendChild(K.dom.el('span', { text: 'إعادة المحاولة' }));
      btn.addEventListener('click', opts.onRetry);
      actions.appendChild(btn);
      wrap.appendChild(actions);
    }
    wrap.style.gridColumn = '1 / -1';
    return wrap;
  };

  /* ═══════════════════════════════════════════════════════════
     تسجيل المسارات
     ═══════════════════════════════════════════════════════════ */

  const registerRoutes = () => {
    const R = K.router;

    /* ---- الترحيبية ---- */
    R.register('/', async () => {
      if (K.session.isAuthenticated) {
        K.router.replace('/home');
        return;
      }
      const { root } = { root: await buildWelcomeScreen() };
      mountScreen(root, { hasTabbar: false });
    }, { title: 'خَيال' });

    /* ---- الرئيسية ---- */
    R.register('/home', async () => {
      K.session.requireLogin('سجّل الدخول لعرض الرئيسية');
      K.store.set('activeSection', 'home', { noPersist: true });

      const { root, feedList } = await buildFeedScreen({
        feedKey: 'home',
        title: `أهلاً ${K.store.get('user')?.displayName || ''}`,
        subtitle: 'أحدث ما نُشر على خَيال',
        showComposer: true,
        showSortbar: true,
        showFilterbar: true,
        empty: {
          icon: 'sparkle',
          title: 'لا منشورات بعد',
          message: 'كن أول من ينشر برومبتاً',
          actionLabel: 'انشر الآن',
          onAction: () => K.router.go('/compose'),
        },
      });
      mountScreen(root);
      renderFeedItems(feedList, 'home');

      // حمّل من الخادم
      if (!K.content.getFeed('home').items.length) {
        await K.content.load({ feed: 'home', refresh: true });
        renderFeedItems(feedList, 'home');
      }
    }, { title: 'الرئيسية' });

    /* ---- الاستكشاف ---- */
    R.register('/explore', async () => {
      K.store.set('activeSection', 'explore', { noPersist: true });
      const { root } = await buildFeedScreen({
        feedKey: 'explore',
        title: 'استكشف',
        subtitle: 'اكتشف إبداعات المجتمع',
        showSortbar: false,
        showFilterbar: false,
      });
      mountScreen(root);
    }, { title: 'استكشاف' });

    /* ---- البحث ---- */
    R.register('/search', async () => {
      K.session.requireLogin();
      const content = K.dom.el('div', { attrs: { style: 'padding:var(--k-space-6) var(--k-space-4);' } });
      content.appendChild(K.dom.el('h1', {
        attrs: { style: 'font-family:var(--k-font-display);font-size:var(--k-fs-2xl);font-weight:700;margin:0 0 var(--k-space-4);' },
        text: 'البحث',
      }));
      const hint = K.dom.el('p', {
        attrs: { style: 'color:var(--k-text-secondary);font-size:var(--k-fs-sm);' },
        text: 'استخدم حقل البحث للعثور على برومبتات ومبدعين ووسوم.',
      });
      content.appendChild(hint);
      mountScreen(content);
    }, { title: 'البحث' });

    /* ---- الإعجابات ---- */
    R.register('/likes', async () => {
      K.session.requireLogin();
      K.store.set('activeSection', 'profile', { noPersist: true });
      const { root, feedList } = await buildFeedScreen({
        feedKey: 'likes',
        title: 'إعجاباتي',
        subtitle: 'ما أعجبك عبر خَيال',
        showSortbar: false,
        showFilterbar: false,
        empty: {
          icon: 'heart',
          title: 'لا إعجابات بعد',
          message: 'تصفّح الرئيسية وأعجبك ما يلهمك',
          actionLabel: 'تصفّح الرئيسية',
          onAction: () => K.router.go('/home'),
        },
      });
      mountScreen(root);
      renderFeedItems(feedList, 'likes');
      await K.content.load({ feed: 'likes', refresh: true });
      renderFeedItems(feedList, 'likes');
    }, { title: 'إعجاباتي' });

    /* ---- المحفوظات ---- */
    R.register('/saved', async () => {
      K.session.requireLogin();
      K.store.set('activeSection', 'profile', { noPersist: true });
      const { root, feedList } = await buildFeedScreen({
        feedKey: 'saved',
        title: 'المحفوظات',
        subtitle: 'مكتبتك الشخصية',
        showSortbar: false,
        showFilterbar: false,
        empty: {
          icon: 'bookmark-simple',
          title: 'لا محفوظات بعد',
          message: 'احفظ ما ترغب بالرجوع إليه',
          actionLabel: 'استكشف',
          onAction: () => K.router.go('/explore'),
        },
      });
      mountScreen(root);
      renderFeedItems(feedList, 'saved');
      await K.content.load({ feed: 'saved', refresh: true });
      renderFeedItems(feedList, 'saved');
    }, { title: 'المحفوظات' });

    /* ---- تفاصيل المنشور ---- */
    R.register('/post/:id', async ({ params }) => {
      const container = K.dom.el('div');
      container.appendChild(K.dom.el('div', {
        attrs: { style: 'padding:var(--k-space-16) 0;text-align:center;' },
      }));

      const loader = K.dom.el('div', { cls: 'k-empty' });
      loader.appendChild(K.dom.el('div', {
        cls: 'k-spinner k-spinner--lg',
        attrs: { style: 'margin:0 auto var(--k-space-4);' },
      }));
      container.appendChild(loader);

      mountScreen(container, { hasTabbar: false });

      // حمّل المنشور
      try {
        const post = await K.api.posts.get(params.id, { force: true });
        if (!post) throw new K.errors.NotFound('المنشور غير موجود');

        const detail = await buildPostDetail(post);
        // استبدل محتوى الشاشة
        const screenInner = runtime.screen.querySelector('.k-screen__content');
        K.dom.clear(screenInner);
        screenInner.appendChild(detail);
      } catch (err) {
        const screenInner = runtime.screen.querySelector('.k-screen__content');
        K.dom.clear(screenInner);
        screenInner.appendChild(buildErrorState({
          message: err.message || 'تعذّر تحميل المنشور',
          onRetry: () => K.router.reload(),
        }));
      }
    }, { title: 'منشور' });

    /* ---- الملف الشخصي ---- */
    R.register('/u/:handle', async ({ params }) => {
      const me = K.store.get('user');
      const isSelf = me?.handle === params.handle;

      const feedKey = `profile:${params.handle}`;
      const { root, feedList } = await buildFeedScreen({
        feedKey,
        title: `@${params.handle}`,
        subtitle: isSelf ? 'ملفك الشخصي' : '',
        showSortbar: false,
        showFilterbar: false,
        empty: {
          icon: 'user',
          title: 'لا منشورات بعد',
          message: isSelf ? 'انشر أول برومبت لك' : 'لم ينشر هذا المبدع بعد',
          actionLabel: isSelf ? 'انشر الآن' : null,
          onAction: isSelf ? () => K.router.go('/compose') : null,
        },
      });
      mountScreen(root);
      renderFeedItems(feedList, feedKey);
      await K.content.load({ feed: feedKey, refresh: true, filters: { author: params.handle } });
      renderFeedItems(feedList, feedKey);
    }, { title: 'ملف شخصي' });

    /* ---- الوسم ---- */
    R.register('/tag/:tag', async ({ params }) => {
      const feedKey = `tag:${params.tag}`;
      const { root, feedList } = await buildFeedScreen({
        feedKey,
        title: `#${params.tag}`,
        subtitle: 'منشورات تحت هذا الوسم',
        showSortbar: false,
        showFilterbar: false,
        empty: {
          icon: 'hash',
          title: 'لا منشورات بهذا الوسم',
          message: 'جرّب وسماً آخر',
          actionLabel: 'استكشف',
          onAction: () => K.router.go('/explore'),
        },
      });
      mountScreen(root);
      renderFeedItems(feedList, feedKey);
      await K.content.load({ feed: feedKey, refresh: true, filters: { tags: [params.tag] } });
      renderFeedItems(feedList, feedKey);
    }, { title: 'وسم' });

    /* ---- الإشعارات ---- */
    R.register('/notifications', async () => {
      K.session.requireLogin();
      K.store.set('activeSection', 'notifications', { noPersist: true });

      const wrap = K.dom.el('div');
      wrap.appendChild(K.dom.el('header', {
        attrs: { style: 'padding:var(--k-space-5) var(--k-space-4) var(--k-space-3);' },
      }));
      const header = wrap.firstChild;
      header.appendChild(K.dom.el('h1', {
        attrs: { style: 'font-family:var(--k-font-display);font-size:var(--k-fs-2xl);font-weight:700;margin:0;' },
        text: 'الإشعارات',
      }));

      const list = K.dom.el('div', { cls: 'k-list k-list--divided', attrs: { 'aria-live': 'polite' } });

      try {
        const data = await K.notificationsApi.load();
        if (!data.items.length) {
          list.appendChild(buildEmptyState({
            icon: 'bell',
            title: 'لا إشعارات',
            message: 'ستظهر هنا تفاعلات الآخرين مع محتواك',
          }));
        } else {
          for (const n of data.items) {
            list.appendChild(buildNotificationRow(n));
          }
        }
      } catch (err) {
        list.appendChild(buildErrorState({
          message: 'تعذّر تحميل الإشعارات',
          onRetry: () => K.router.reload(),
        }));
      }

      wrap.appendChild(list);
      mountScreen(wrap);

      // وسم الكل مقروءاً عند العرض
      K.utils.tryCatch(() => K.notificationsApi.markAllRead());
    }, { title: 'الإشعارات' });

    /* ---- الرسائل ---- */
    R.register('/messages', async () => {
      K.session.requireLogin();
      K.store.set('activeSection', 'messages', { noPersist: true });

      const wrap = K.dom.el('div', { cls: 'k-messages' });
      wrap.appendChild(K.dom.el('header', {
        cls: 'k-messages__header',
        attrs: { style: '' },
      }));

      const header = wrap.firstChild;
      header.appendChild(K.dom.el('h1', {
        cls: 'k-messages__title',
        text: 'الرسائل',
      }));

      const list = K.dom.el('div', { cls: 'k-messages__list' });

      try {
        const data = await K.messages.list();
        if (!data.items?.length) {
          list.appendChild(buildEmptyState({
            icon: 'chat-circle',
            title: 'لا محادثات',
            message: 'ابدأ حواراً مع مبدع',
          }));
        } else {
          for (const c of data.items) {
            list.appendChild(buildChatItem(c));
          }
        }
      } catch (err) {
        list.appendChild(buildErrorState({
          message: 'تعذّر تحميل الرسائل',
          onRetry: () => K.router.reload(),
        }));
      }
      wrap.appendChild(list);
      mountScreen(wrap);
    }, { title: 'الرسائل' });

    /* ---- الإعدادات ---- */
    R.register('/settings', async () => {
      K.session.requireLogin();
      const content = K.dom.el('div');
      content.appendChild(K.dom.el('header', {
        attrs: { style: 'padding:var(--k-space-5) var(--k-space-4) var(--k-space-3);' },
      }));
      const header = content.firstChild;
      header.appendChild(K.dom.el('h1', {
        attrs: { style: 'font-family:var(--k-font-display);font-size:var(--k-fs-2xl);font-weight:700;margin:0;' },
        text: 'الإعدادات',
      }));

      const body = K.dom.el('div', { cls: 'k-settings__body' });

      // مجموعة المظهر
      const themeGroup = K.dom.el('div', { cls: 'k-settings-group' });
      themeGroup.appendChild(K.dom.el('div', { cls: 'k-settings-group__head' })).appendChild(
        K.dom.el('div', { cls: 'k-settings-group__label', text: 'المظهر' }),
      );

      const themeList = K.dom.el('div', { cls: 'k-settings-group__list' });
      const currentTheme = K.theme.choice;

      for (const choice of [
        { key: 'light', label: 'فاتح', icon: 'sun' },
        { key: 'dark', label: 'داكن', icon: 'moon' },
        { key: 'system', label: 'حسب النظام', icon: 'device-mobile' },
      ]) {
        const row = K.dom.el('button', {
          cls: 'k-settings-row',
          attrs: { type: 'button', 'aria-pressed': currentTheme === choice.key ? 'true' : 'false' },
        });
        if (currentTheme === choice.key) row.dataset.active = 'true';

        const iconWrap = K.dom.el('span', { cls: 'k-settings-row__icon' });
        iconWrap.appendChild(K.icons.get(choice.icon, { size: 18 }));
        row.appendChild(iconWrap);

        row.appendChild(K.dom.el('span', { cls: 'k-settings-row__body' })).appendChild(
          K.dom.el('span', { cls: 'k-settings-row__title', text: choice.label }),
        );

        row.addEventListener('click', () => {
          K.theme.set(choice.key);
          themeList.querySelectorAll('.k-settings-row').forEach(r => {
            r.dataset.active = 'false';
            r.setAttribute('aria-pressed', 'false');
          });
          row.dataset.active = 'true';
          row.setAttribute('aria-pressed', 'true');
        });
        themeList.appendChild(row);
      }
      themeGroup.appendChild(themeList);
      body.appendChild(themeGroup);

      // مجموعة الصوت
      const soundGroup = K.dom.el('div', { cls: 'k-settings-group' });
      soundGroup.appendChild(K.dom.el('div', { cls: 'k-settings-group__head' })).appendChild(
        K.dom.el('div', { cls: 'k-settings-group__label', text: 'الصوت والاهتزاز' }),
      );

      const soundList = K.dom.el('div', { cls: 'k-settings-group__list' });
      soundList.appendChild(buildToggleRow({
        title: 'الأصوات',
        subtitle: 'نبرات عند التفاعلات',
        checked: K.store.get('prefs.soundEnabled', true),
        onChange: (v) => K.store.set('prefs.soundEnabled', v),
      }));
      soundList.appendChild(buildToggleRow({
        title: 'الاهتزاز',
        subtitle: 'اهتزاز خفيف عند اللمس',
        checked: K.store.get('prefs.hapticEnabled', true),
        onChange: (v) => K.store.set('prefs.hapticEnabled', v),
      }));
      soundGroup.appendChild(soundList);
      body.appendChild(soundGroup);

      // منطقة خطرة
      const danger = K.dom.el('div', { cls: 'k-danger-zone' });
      const dangerHead = K.dom.el('div', { cls: 'k-danger-zone__head' });
      const dangerIcon = K.dom.el('div', { cls: 'k-danger-zone__icon' });
      dangerIcon.appendChild(K.icons.get('sign-out', { size: 18, stroke: 2 }));
      dangerHead.appendChild(dangerIcon);
      dangerHead.appendChild(K.dom.el('div', {
        cls: 'k-danger-zone__title',
        text: 'الخروج من الحساب',
      }));
      danger.appendChild(dangerHead);
      danger.appendChild(K.dom.el('p', {
        cls: 'k-danger-zone__text',
        text: 'يمكنك تسجيل الدخول مجدداً في أي وقت.',
      }));

      const dangerActions = K.dom.el('div', { cls: 'k-danger-zone__actions' });
      const logoutBtn = K.dom.el('button', {
        cls: 'k-btn k-btn--md k-btn--danger-ghost',
        attrs: { type: 'button' },
      });
      logoutBtn.appendChild(K.icons.get('sign-out', { size: 16 }));
      logoutBtn.appendChild(K.dom.el('span', { text: 'تسجيل الخروج' }));
      logoutBtn.addEventListener('click', async () => {
        const ok = await K.overlays.confirm({
          title: 'تسجيل الخروج؟',
          message: 'ستحتاج إدخال بياناتك للمرة القادمة.',
          variant: 'warning',
          confirmLabel: 'خروج',
        });
        if (ok) await K.session.logout();
      });
      dangerActions.appendChild(logoutBtn);
      danger.appendChild(dangerActions);
      body.appendChild(danger);

      content.appendChild(body);
      mountScreen(content);
    }, { title: 'الإعدادات' });

    /* ---- محرّر النشر ---- */
    R.register('/compose', async () => {
      K.session.requireLogin();
      mountScreen(await buildComposerScreen(), { hasTabbar: false });
    }, { title: 'نشر جديد' });

    /* ---- صفحة غير موجودة ---- */
    R.register('*', async () => {
      const wrap = K.dom.el('div', { attrs: { style: 'padding:var(--k-space-16) var(--k-space-4);' } });
      wrap.appendChild(buildEmptyState({
        icon: 'compass',
        title: '404 · الصفحة غير موجودة',
        message: 'قد يكون الرابط قديماً أو غير صحيح',
        actionLabel: 'العودة للرئيسية',
        onAction: () => K.router.home(),
      }));
      mountScreen(wrap, { hasTabbar: false });
    }, { title: 'غير موجودة' });
  };

  /* ═══════════════════════════════════════════════════════════
     مكوّنات مساعدة إضافية
     ═══════════════════════════════════════════════════════════ */

  const buildToggleRow = (opts) => {
    const row = K.dom.el('div', { cls: 'k-settings-toggle' });

    const body = K.dom.el('div', { cls: 'k-settings-toggle__body' });
    body.appendChild(K.dom.el('div', {
      cls: 'k-settings-toggle__title',
      text: opts.title,
    }));
    if (opts.subtitle) {
      body.appendChild(K.dom.el('div', {
        cls: 'k-settings-toggle__subtitle',
        text: opts.subtitle,
      }));
    }
    row.appendChild(body);

    const switchLabel = K.dom.el('label', { cls: 'k-switch' });
    const input = K.dom.el('input', {
      attrs: { type: 'checkbox', ...(opts.checked ? { checked: true } : {}) },
    });
    input.addEventListener('change', () => {
      opts.onChange?.(input.checked);
      if (input.checked) K.sound.tap();
    });
    switchLabel.appendChild(input);
    const track = K.dom.el('span', { cls: 'k-switch__track' });
    track.appendChild(K.dom.el('span', { cls: 'k-switch__thumb' }));
    switchLabel.appendChild(track);
    row.appendChild(switchLabel);

    return row;
  };

  const buildNotificationRow = (notif) => {
    const row = K.dom.el('div', {
      cls: 'k-notif',
      attrs: { role: 'button', tabindex: '0' },
      data: { unread: notif.unread ? 'true' : 'false' },
    });

    const avatarWrap = K.dom.el('div', { cls: 'k-notif__avatar-wrap' });
    const avatar = K.dom.el('div', { cls: 'k-avatar k-avatar--md' });
    if (notif.actor?.avatar) {
      avatar.appendChild(K.dom.el('img', {
        attrs: { src: notif.actor.avatar, alt: '', loading: 'lazy' },
      }));
    } else {
      avatar.appendChild(K.dom.el('span', {
        cls: 'k-avatar__fallback',
        text: notif.actor?.displayName?.[0] || '؟',
      }));
    }
    avatarWrap.appendChild(avatar);

    const badgeIcon = {
      like: 'heart', comment: 'chat-circle', follow: 'user-plus',
      save: 'bookmark-simple', mention: 'at',
    }[notif.type] || 'bell';
    const badge = K.dom.el('span', {
      cls: `k-notif__badge k-notif__badge--${notif.type}`,
    });
    badge.appendChild(K.icons.get(badgeIcon, { size: 10, stroke: 2.5 }));
    avatarWrap.appendChild(badge);
    row.appendChild(avatarWrap);

    const body = K.dom.el('div', { cls: 'k-notif__body' });
    const text = K.dom.el('div', { cls: 'k-notif__text' });
    const actorName = K.dom.el('strong');
    actorName.textContent = notif.actor?.displayName || 'مبدع';
    text.appendChild(actorName);
    text.appendChild(K.dom.text(' ' + (notif.text || 'تفاعل مع محتواك')));
    body.appendChild(text);
    body.appendChild(K.dom.el('div', {
      cls: 'k-notif__time',
      text: K.format.since(notif.createdAt),
    }));
    row.appendChild(body);

    if (notif.targetThumb) {
      const thumb = K.dom.el('div', { cls: 'k-notif__thumb' });
      thumb.appendChild(K.dom.el('img', {
        attrs: { src: notif.targetThumb, alt: '', loading: 'lazy' },
      }));
      row.appendChild(thumb);
    }

    if (notif.targetId && ['like', 'comment', 'save', 'mention'].includes(notif.type)) {
      row.addEventListener('click', () => {
        K.notificationsApi.markRead(notif.id);
        K.router.go(`/post/${notif.targetId}`);
      });
    } else if (notif.type === 'follow' && notif.actor?.handle) {
      row.addEventListener('click', () => {
        K.notificationsApi.markRead(notif.id);
        K.router.go(`/u/${notif.actor.handle}`);
      });
    }

    return row;
  };

  const buildChatItem = (conv) => {
    const item = K.dom.el('div', {
      cls: 'k-chat',
      attrs: { role: 'button', tabindex: '0' },
      data: { unread: conv.unreadCount > 0 ? 'true' : 'false' },
    });

    const avatar = K.dom.el('div', { cls: 'k-avatar k-avatar--lg k-chat__avatar' });
    if (conv.peer?.avatar) {
      avatar.appendChild(K.dom.el('img', {
        attrs: { src: conv.peer.avatar, alt: '', loading: 'lazy' },
      }));
    } else {
      avatar.appendChild(K.dom.el('span', {
        cls: 'k-avatar__fallback',
        text: conv.peer?.displayName?.[0] || '؟',
      }));
    }
    item.appendChild(avatar);

    const body = K.dom.el('div', { cls: 'k-chat__body' });
    const head = K.dom.el('div', { cls: 'k-chat__head' });
    head.appendChild(K.dom.el('span', {
      cls: 'k-chat__name',
      text: conv.peer?.displayName || 'مستخدم',
    }));
    head.appendChild(K.dom.el('span', {
      cls: 'k-chat__time',
      text: K.format.messageTime(conv.updatedAt),
    }));
    body.appendChild(head);

    const row = K.dom.el('div', { cls: 'k-chat__row' });
    row.appendChild(K.dom.el('span', {
      cls: 'k-chat__preview',
      text: conv.lastMessage?.text || 'لا رسائل بعد',
    }));

    if (conv.unreadCount > 0) {
      const count = K.dom.el('span', {
        cls: 'k-count k-chat__count',
        text: K.format.num(conv.unreadCount),
      });
      row.appendChild(count);
    }
    body.appendChild(row);
    item.appendChild(body);

    item.addEventListener('click', () => {
      K.router.go(`/messages/${conv.id}`);
    });

    return item;
  };

  /* ═══════════════════════════════════════════════════════════
     شاشة تفاصيل المنشور — بناء كامل
     ═══════════════════════════════════════════════════════════ */

  const buildPostDetail = async (post) => {
    const wrap = K.dom.el('div');

    // الشريط العلوي
    const topbar = K.dom.el('header', {
      cls: 'k-detail__topbar',
      data: { scrolled: 'false' },
    });
    const back = K.dom.el('button', {
      cls: 'k-detail__back',
      attrs: { type: 'button', 'aria-label': 'رجوع' },
    });
    back.appendChild(K.icons.get('arrow-right', { size: 20, stroke: 1.75 }));
    back.addEventListener('click', () => K.router.back());
    topbar.appendChild(back);
    topbar.appendChild(K.dom.el('h2', {
      cls: 'k-detail__topbar-title',
      text: post.title,
    }));
    const menuBtn = K.dom.el('button', {
      cls: 'k-detail__menu',
      attrs: { type: 'button', 'aria-label': 'خيارات' },
    });
    menuBtn.appendChild(K.icons.get('dots-three', { size: 20 }));
    menuBtn.addEventListener('click', () => openPostMenu(post, menuBtn));
    topbar.appendChild(menuBtn);
    wrap.appendChild(topbar);

    // مراقبة التمرير لتغيير الحالة
    const scrollListener = K.utils.throttleRAF(() => {
      const screen = runtime.screen;
      if (!screen) return;
      if (screen.scrollTop > 60) topbar.dataset.scrolled = 'true';
      else topbar.dataset.scrolled = 'false';
    });
    setTimeout(() => {
      runtime.screen?.addEventListener('scroll', scrollListener, { passive: true });
    }, 100);
    registerCleanup(() => runtime.screen?.removeEventListener('scroll', scrollListener));

    // منطقة الصورة
    const media = K.dom.el('div', { cls: 'k-detail__media' });
    if (post.cover) {
      const img = K.dom.el('img', {
        cls: 'k-detail__image',
        attrs: { src: post.cover, alt: post.title, loading: 'eager' },
      });
      media.appendChild(img);
    }
    if (post.model) {
      const overlay = K.dom.el('div', { cls: 'k-detail__media-overlay' });
      const model = K.dom.el('div', { cls: 'k-post__model' });
      model.appendChild(K.icons.get('sparkle', { size: 12, stroke: 2 }));
      model.appendChild(K.dom.el('span', { text: post.model }));
      overlay.appendChild(model);
      media.appendChild(overlay);
    }
    wrap.appendChild(media);

    // الجسم
    const body = K.dom.el('div', { cls: 'k-detail__body' });

    body.appendChild(K.dom.el('h1', {
      cls: 'k-detail__title',
      text: post.title,
    }));

    // الميتا
    const meta = K.dom.el('div', { cls: 'k-detail__meta' });
    const metaDate = K.dom.el('span', { cls: 'k-detail__meta-item' });
    metaDate.appendChild(K.icons.get('clock', { size: 14, stroke: 1.75 }));
    metaDate.appendChild(K.dom.el('span', { text: K.format.since(post.createdAt) }));
    meta.appendChild(metaDate);
    if (post.model) {
      meta.appendChild(K.dom.el('span', { cls: 'k-detail__meta-divider' }));
      const metaModel = K.dom.el('span', { cls: 'k-detail__meta-item' });
      metaModel.appendChild(K.icons.get('sparkle', { size: 14, stroke: 1.75 }));
      metaModel.appendChild(K.dom.el('span', { text: post.model }));
      meta.appendChild(metaModel);
    }
    body.appendChild(meta);

    // بطاقة المؤلف
    if (post.author) {
      const authorCard = K.dom.el('div', { cls: 'k-detail__author' });
      const avatar = K.dom.el('div', { cls: 'k-avatar k-avatar--md' });
      if (post.author.avatar) {
        avatar.appendChild(K.dom.el('img', {
          attrs: { src: post.author.avatar, alt: '', loading: 'lazy' },
        }));
      } else {
        avatar.appendChild(K.dom.el('span', {
          cls: 'k-avatar__fallback',
          text: post.author.displayName?.[0] || '؟',
        }));
      }
      authorCard.appendChild(avatar);

      const info = K.dom.el('div', { cls: 'k-detail__author-info' });
      const nameRow = K.dom.el('div', { cls: 'k-detail__author-name' });
      nameRow.appendChild(K.dom.el('span', { text: post.author.displayName }));
      if (post.author.verified) {
        nameRow.appendChild(K.icons.get('seal-check', { size: 14, stroke: 2, color: 'var(--k-brand-500)' }));
      }
      info.appendChild(nameRow);
      info.appendChild(K.dom.el('div', {
        cls: 'k-detail__author-handle',
        text: `@${post.author.handle}`,
      }));
      authorCard.appendChild(info);

      // زر متابعة
      const me = K.store.get('user');
      if (post.author.id !== me?.id) {
        const followBtn = K.dom.el('button', {
          cls: `k-btn k-btn--sm k-btn--${post.author.relation?.isFollowing ? 'secondary' : 'primary'}`,
          attrs: { type: 'button' },
          text: post.author.relation?.isFollowing ? 'متابع' : 'متابعة',
        });
        followBtn.dataset.following = post.author.relation?.isFollowing ? 'true' : 'false';
        followBtn.addEventListener('click', async () => {
          try {
            const now = await K.actions.toggleFollow(post.author);
            if (now !== undefined) {
              followBtn.dataset.following = now ? 'true' : 'false';
              followBtn.textContent = now ? 'متابع' : 'متابعة';
              followBtn.classList.toggle('k-btn--secondary', now);
              followBtn.classList.toggle('k-btn--primary', !now);
            }
          } catch { /* معالَج */ }
        });
        const action = K.dom.el('div', { cls: 'k-detail__author-action' });
        action.appendChild(followBtn);
        authorCard.appendChild(action);
      }
      body.appendChild(authorCard);
    }

    // قسم البرومبت
    if (post.prompt) {
      const promptBlock = K.dom.el('div', { cls: 'k-prompt-block' });
      const phead = K.dom.el('div', { cls: 'k-prompt-block__head' });
      const plabel = K.dom.el('div', { cls: 'k-prompt-block__label' });
      plabel.appendChild(K.icons.get('code', { size: 14, stroke: 2 }));
      plabel.appendChild(K.dom.el('span', { text: 'البرومبت' }));
      phead.appendChild(plabel);

      const copyBtn = K.dom.el('button', {
        cls: 'k-btn k-btn--sm k-btn--secondary',
        attrs: { type: 'button' },
      });
      copyBtn.appendChild(K.icons.get('copy', { size: 14, stroke: 1.75 }));
      copyBtn.appendChild(K.dom.el('span', { text: 'نسخ' }));
      copyBtn.addEventListener('click', async () => {
        await K.actions.copyPrompt(post.id, post.prompt);
        copyBtn.dataset.copied = 'true';
        const span = copyBtn.querySelector('span');
        if (span) span.textContent = 'نُسخ';
        setTimeout(() => {
          delete copyBtn.dataset.copied;
          if (span) span.textContent = 'نسخ';
        }, 1600);
      });
      phead.appendChild(copyBtn);
      promptBlock.appendChild(phead);

      const code = K.dom.el('code', {
        cls: 'k-prompt-block__code',
        text: post.prompt,
      });
      promptBlock.appendChild(code);
      body.appendChild(promptBlock);
    }

    // الوسوم
    if (post.tags?.length) {
      const tags = K.dom.el('div', { cls: 'k-detail__tags' });
      for (const t of post.tags) {
        const tagEl = K.dom.el('button', {
          cls: 'k-tag',
          attrs: { type: 'button' },
          text: `#${t}`,
        });
        tagEl.addEventListener('click', () => K.router.go(`/tag/${t}`));
        tags.appendChild(tagEl);
      }
      body.appendChild(tags);
    }

    // الإحصائيات
    const stats = K.dom.el('div', { cls: 'k-detail__stats' });
    const statItems = [
      { label: 'إعجاب', value: post.stats?.likes || 0, icon: 'heart', key: 'likes' },
      { label: 'حفظ', value: post.stats?.saves || 0, icon: 'bookmark-simple', key: 'saves' },
      { label: 'نسخ', value: post.stats?.copies || 0, icon: 'copy', key: 'copies' },
      { label: 'تعليق', value: post.stats?.comments || 0, icon: 'chat-circle', key: 'comments' },
    ];
    for (const s of statItems) {
      const stat = K.dom.el('div', { cls: 'k-detail__stat' });
      stat.appendChild(K.dom.el('div', {
        cls: 'k-detail__stat-value',
        text: K.format.compact(s.value),
      }));
      const label = K.dom.el('div', { cls: 'k-detail__stat-label' });
      label.appendChild(K.icons.get(s.icon, { size: 12, stroke: 2 }));
      label.appendChild(K.dom.el('span', { text: s.label }));
      stat.appendChild(label);
      stats.appendChild(stat);
    }
    body.appendChild(stats);

    // شريط الإجراءات العائم
    const actionBar = K.dom.el('div', {
      cls: 'k-detail__action-bar',
      attrs: { role: 'toolbar', 'aria-label': 'إجراءات' },
    });

    const likeAct = K.dom.el('button', {
      cls: 'k-detail__action',
      attrs: {
        type: 'button',
        'aria-label': post.viewer?.liked ? 'إلغاء الإعجاب' : 'إعجاب',
        'data-liked': post.viewer?.liked ? 'true' : 'false',
      },
    });
    likeAct.appendChild(K.icons.get('heart', { size: 18, stroke: 1.75 }));
    likeAct.appendChild(K.dom.el('span', { text: 'إعجاب' }));
    likeAct.addEventListener('click', () => handleToggleLike(post, likeAct));
    actionBar.appendChild(likeAct);

    const saveAct = K.dom.el('button', {
      cls: 'k-detail__action',
      attrs: {
        type: 'button',
        'aria-label': post.viewer?.saved ? 'إزالة الحفظ' : 'حفظ',
        'data-saved': post.viewer?.saved ? 'true' : 'false',
      },
    });
    saveAct.appendChild(K.icons.get('bookmark-simple', { size: 18, stroke: 1.75 }));
    saveAct.appendChild(K.dom.el('span', { text: 'حفظ' }));
    saveAct.addEventListener('click', () => handleToggleSave(post, saveAct));
    actionBar.appendChild(saveAct);

    const shareAct = K.dom.el('button', {
      cls: 'k-detail__action k-detail__action--primary',
      attrs: { type: 'button', 'aria-label': 'مشاركة' },
    });
    shareAct.appendChild(K.icons.get('share-network', { size: 18, stroke: 1.75 }));
    shareAct.appendChild(K.dom.el('span', { text: 'شارك' }));
    shareAct.addEventListener('click', () => K.overlays.shareModal(post));
    actionBar.appendChild(shareAct);

    body.appendChild(actionBar);

    // التعليقات
    const comments = K.dom.el('div', { cls: 'k-detail__comments', attrs: { id: 'comments' } });
    const cHead = K.dom.el('div', { cls: 'k-detail__comments-head' });
    const cTitle = K.dom.el('div', { cls: 'k-detail__comments-title' });
    cTitle.appendChild(K.dom.text('التعليقات'));
    cTitle.appendChild(K.dom.el('span', {
      cls: 'k-detail__comments-count',
      text: K.format.num(post.stats?.comments || 0),
    }));
    cHead.appendChild(cTitle);
    comments.appendChild(cHead);

    const cList = K.dom.el('div', { cls: 'k-detail__comments-list' });
    comments.appendChild(cList);

    // حمّل التعليقات
    try {
      const { state } = await K.actions.loadComments(post.id) || {};
      if (!state?.items?.length) {
        cList.appendChild(K.dom.el('p', {
          attrs: { style: 'padding:var(--k-space-6) 0;text-align:center;color:var(--k-text-tertiary);font-size:var(--k-fs-sm);' },
          text: 'لا تعليقات بعد — كن أول من يعلّق',
        }));
      } else {
        for (const c of state.items) {
          cList.appendChild(buildCommentItem(c));
        }
      }
    } catch { /* صامت */ }

    // محرّر تعليق
    const composer = K.dom.el('div', { cls: 'k-comment-composer' });
    const field = K.dom.el('textarea', {
      cls: 'k-comment-composer__field',
      attrs: { placeholder: 'أضف تعليقاً…', rows: '1' },
    });
    composer.appendChild(field);
    const sendBtn = K.dom.el('button', {
      cls: 'k-comment-composer__send',
      attrs: { type: 'button', 'aria-label': 'إرسال' },
    });
    sendBtn.appendChild(K.icons.get('arrow-up', { size: 18, stroke: 2 }));
    sendBtn.disabled = true;
    field.addEventListener('input', () => {
      sendBtn.disabled = !field.value.trim();
    });
    sendBtn.addEventListener('click', async () => {
      const text = field.value.trim();
      if (!text) return;
      field.value = '';
      sendBtn.disabled = true;
      try {
        const comment = await K.actions.postComment(post.id, text);
        if (comment) {
          // أزل رسالة "لا تعليقات" إن وُجدت
          const empty = cList.querySelector('p');
          if (empty) empty.remove();
          const item = buildCommentItem(comment);
          cList.insertBefore(item, cList.firstChild);
        }
      } catch { /* معالَج */ }
    });
    composer.appendChild(sendBtn);
    comments.appendChild(composer);

    body.appendChild(comments);

    wrap.appendChild(body);
    return wrap;
  };

  const buildCommentItem = (comment) => {
    const item = K.dom.el('div', { cls: 'k-comment' });
    const avatar = K.dom.el('div', { cls: 'k-avatar k-avatar--sm k-comment__avatar' });
    if (comment.author?.avatar) {
      avatar.appendChild(K.dom.el('img', {
        attrs: { src: comment.author.avatar, alt: '', loading: 'lazy' },
      }));
    } else {
      avatar.appendChild(K.dom.el('span', {
        cls: 'k-avatar__fallback',
        text: comment.author?.displayName?.[0] || '؟',
      }));
    }
    item.appendChild(avatar);

    const body = K.dom.el('div', { cls: 'k-comment__body' });
    const header = K.dom.el('div', { cls: 'k-comment__header' });
    header.appendChild(K.dom.el('span', {
      cls: 'k-comment__author',
      text: comment.author?.displayName || 'مستخدم',
    }));
    header.appendChild(K.dom.el('span', {
      cls: 'k-comment__time',
      text: K.format.since(comment.createdAt),
    }));
    body.appendChild(header);
    body.appendChild(K.dom.el('p', {
      cls: 'k-comment__text',
      text: comment.text,
    }));

    if (comment.viewer?.canDelete) {
      const actions = K.dom.el('div', { cls: 'k-comment__actions' });
      const delBtn = K.dom.el('button', {
        cls: 'k-comment__action k-comment__action--danger',
        attrs: { type: 'button' },
      });
      delBtn.appendChild(K.icons.get('trash', { size: 14, stroke: 1.5 }));
      delBtn.appendChild(K.dom.el('span', { text: 'حذف' }));
      delBtn.addEventListener('click', async () => {
        const ok = await K.overlays.confirm({
          title: 'حذف التعليق؟',
          variant: 'danger',
          confirmLabel: 'احذف',
          destructive: true,
        });
        if (ok) {
          try {
            await K.actions.deleteComment(comment.postId, comment.id);
            item.style.transition = 'opacity 200ms';
            item.style.opacity = '0';
            setTimeout(() => K.dom.remove(item), 200);
          } catch { /* معالَج */ }
        }
      });
      actions.appendChild(delBtn);
      body.appendChild(actions);
    }

    item.appendChild(body);
    return item;
  };

  /* ═══════════════════════════════════════════════════════════
     محرّر النشر
     ═══════════════════════════════════════════════════════════ */

  const buildComposerScreen = async () => {
    const wrap = K.dom.el('div');

    // الشريط العلوي
    const topbar = K.dom.el('header', { cls: 'k-appbar' });
    const closeBtn = K.dom.el('button', {
      cls: 'k-appbar__action',
      attrs: { type: 'button', 'aria-label': 'إغلاق' },
    });
    closeBtn.appendChild(K.icons.get('x', { size: 20, stroke: 1.75 }));
    closeBtn.addEventListener('click', () => K.router.back());
    topbar.appendChild(closeBtn);
    topbar.appendChild(K.dom.el('div', { cls: 'k-appbar__center' })).appendChild(
      K.dom.el('h1', { cls: 'k-appbar__title', text: 'نشر جديد' }),
    );

    const publishBtn = K.dom.el('button', {
      cls: 'k-btn k-btn--sm k-btn--primary',
      attrs: { type: 'button' },
      text: 'نشر',
    });
    publishBtn.dataset.loading = 'false';
    topbar.appendChild(publishBtn);
    wrap.appendChild(topbar);

    // الحقول
    const form = K.dom.el('form', { attrs: { style: 'padding:var(--k-space-5) var(--k-space-4) var(--k-space-10);display:flex;flex-direction:column;gap:var(--k-space-5);' } });

    // العنوان
    const titleField = K.dom.el('div', { cls: 'k-field' });
    titleField.appendChild(K.dom.el('label', {
      cls: 'k-field__label',
      text: 'العنوان',
    }));
    const titleInput = K.dom.el('input', {
      cls: 'k-input__field',
      attrs: { type: 'text', maxLength: '200', placeholder: 'عنوان موجز وجاذب' },
    });
    const titleWrap = K.dom.el('div', { cls: 'k-input' });
    titleWrap.appendChild(titleInput);
    titleField.appendChild(titleWrap);
    form.appendChild(titleField);

    // البرومبت
    const promptField = K.dom.el('div', { cls: 'k-field' });
    promptField.appendChild(K.dom.el('label', {
      cls: 'k-field__label',
      text: 'البرومبت',
    }));
    const promptArea = K.dom.el('div', { cls: 'k-textarea' });
    const promptInput = K.dom.el('textarea', {
      cls: 'k-textarea__field',
      attrs: { rows: '6', maxLength: '4000', placeholder: 'اكتب البرومبت الكامل هنا…' },
    });
    promptArea.appendChild(promptInput);
    const promptFooter = K.dom.el('div', { cls: 'k-textarea__footer' });
    promptFooter.appendChild(K.dom.el('span', { text: 'اكتب بالتفصيل للحصول على نتائج أفضل' }));
    const promptCount = K.dom.el('span', { cls: 'k-textarea__count', text: '0 / 4000' });
    promptFooter.appendChild(promptCount);
    promptArea.appendChild(promptFooter);
    promptField.appendChild(promptArea);
    form.appendChild(promptField);

    promptInput.addEventListener('input', () => {
      const len = promptInput.value.length;
      promptCount.textContent = `${K.format.num(len)} / ${K.format.num(4000)}`;
      promptCount.dataset.warn = len > 3500 ? 'true' : 'false';
      promptCount.dataset.over = len >= 4000 ? 'true' : 'false';
    });

    // الموديل
    const modelField = K.dom.el('div', { cls: 'k-field' });
    modelField.appendChild(K.dom.el('label', {
      cls: 'k-field__label',
      text: 'الموديل',
    }));
    const modelSelect = K.dom.el('select', { cls: 'k-select__field' });
    for (const m of ['Midjourney', 'DALL·E 3', 'Stable Diffusion', 'Flux', 'Adobe Firefly', 'Leonardo', 'أخرى']) {
      const opt = K.dom.el('option', { attrs: { value: m }, text: m });
      modelSelect.appendChild(opt);
    }
    const modelWrap = K.dom.el('div', { cls: 'k-select' });
    modelWrap.appendChild(modelSelect);
    const chev = K.dom.el('span', { cls: 'k-select__chevron' });
    chev.appendChild(K.icons.get('caret-down', { size: 16, stroke: 1.75 }));
    modelWrap.appendChild(chev);
    modelField.appendChild(modelWrap);
    form.appendChild(modelField);

    // الوسوم
    const tagsField = K.dom.el('div', { cls: 'k-field' });
    tagsField.appendChild(K.dom.el('label', {
      cls: 'k-field__label',
      text: 'الوسوم',
    }));
    const tagsWrap = K.dom.el('div', { cls: 'k-input' });
    const tagsInput = K.dom.el('input', {
      cls: 'k-input__field',
      attrs: { type: 'text', placeholder: 'اكتب وسم ثم اضغط Enter' },
    });
    tagsWrap.appendChild(tagsInput);
    tagsField.appendChild(tagsWrap);

    const tagsList = K.dom.el('div', {
      cls: 'k-post__tags',
      attrs: { style: 'margin-top:var(--k-space-2);' },
    });
    tagsField.appendChild(tagsList);

    const tags = new Set();
    const renderTags = () => {
      K.dom.clear(tagsList);
      for (const t of tags) {
        const tagEl = K.dom.el('span', {
          cls: 'k-post__tag',
          attrs: { style: 'cursor:pointer;' },
          text: `#${t}`,
        });
        tagEl.addEventListener('click', () => {
          tags.delete(t);
          renderTags();
        });
        tagsList.appendChild(tagEl);
      }
    };

    tagsInput.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter' || evt.key === ',') {
        evt.preventDefault();
        const v = tagsInput.value.trim().replace(/^#/, '').toLowerCase().replace(/\s+/g, '-');
        if (!v) return;
        if (tags.size >= 8) {
          K.overlays.toast({ type: 'warning', title: '٨ وسوم كحد أقصى', duration: 2200 });
          return;
        }
        const check = K.validate.tag(v);
        if (!check.ok) {
          K.overlays.toast({ type: 'warning', title: check.error, duration: 2200 });
          return;
        }
        tags.add(check.value);
        tagsInput.value = '';
        renderTags();
      }
    });

    form.appendChild(tagsField);

    // الصورة (مبدئي: إدخال URL)
    const imageField = K.dom.el('div', { cls: 'k-field' });
    imageField.appendChild(K.dom.el('label', {
      cls: 'k-field__label',
      text: 'الصورة (رابط)',
    }));
    const imageWrap = K.dom.el('div', { cls: 'k-input' });
    const imageInput = K.dom.el('input', {
      cls: 'k-input__field',
      attrs: { type: 'url', placeholder: 'https://…' },
    });
    imageWrap.appendChild(imageInput);
    imageField.appendChild(imageWrap);
    form.appendChild(imageField);

    wrap.appendChild(form);

    // زر النشر
    publishBtn.addEventListener('click', async () => {
      const payload = {
        title: titleInput.value.trim(),
        prompt: promptInput.value.trim(),
        images: [imageInput.value.trim()].filter(Boolean),
        model: modelSelect.value,
        tags: Array.from(tags),
      };

      // تحقق سريع
      try {
        K.validate.title(payload.title);
        K.validate.prompt(payload.prompt);
        if (!payload.images.length) {
          throw new K.errors.Validate('أضف صورة على الأقل');
        }
      } catch (err) {
        K.overlays.toast({ type: 'warning', title: err.message, duration: 3000 });
        return;
      }

      publishBtn.dataset.loading = 'true';
      publishBtn.setAttribute('aria-busy', 'true');

      try {
        const post = await K.api.posts.create(payload);
        K.content.prependItem('home', post);
        K.sound.success();
        K.overlays.toast({
          type: 'success',
          title: 'نُشر بنجاح',
          message: 'يظهر الآن في الرئيسية',
          duration: 2500,
        });
        // انتقل للتفاصيل
        K.router.go(`/post/${post.id}`);
      } catch (err) {
        delete publishBtn.dataset.loading;
        publishBtn.removeAttribute('aria-busy');
        K.overlays.toast({
          type: 'error',
          title: 'لم يكتمل النشر',
          message: err.message || 'حاول مجدداً',
          duration: 4000,
        });
      }
    });

    return wrap;
  };

  /* ═══════════════════════════════════════════════════════════
     الشريط السفلي (Tabbar)
     ═══════════════════════════════════════════════════════════ */

  const buildTabbar = () => {
    const tabbar = K.dom.el('nav', {
      cls: 'k-tabbar',
      attrs: { role: 'tablist', 'aria-label': 'التنقّل الأساسي' },
      id: 'khayal-tabbar',
    });

    const sections = [
      { key: 'home',          label: 'الرئيسية',   icon: 'house',       path: '/home' },
      { key: 'explore',       label: 'استكشاف',    icon: 'compass',     path: '/explore' },
      { key: 'compose',       label: 'انشر',       icon: 'plus',        path: '/compose', accent: true },
      { key: 'notifications', label: 'الإشعارات',  icon: 'bell',        path: '/notifications' },
      { key: 'messages',      label: 'الرسائل',    icon: 'chat-circle', path: '/messages' },
    ];

    for (const s of sections) {
      const btn = K.dom.el('button', {
        cls: `k-tabbar__item${s.accent ? ' k-tabbar__item--accent' : ''}`,
        attrs: {
          type: 'button',
          role: 'tab',
          'aria-label': s.label,
          'aria-selected': 'false',
        },
        data: { section: s.key },
      });

      if (s.accent) {
        const iconWrap = K.dom.el('span', { cls: 'k-tabbar__icon-wrap' });
        iconWrap.appendChild(K.icons.get(s.icon, { size: 22, stroke: 1.75 }));
        btn.appendChild(iconWrap);
      } else {
        btn.appendChild(K.icons.get(s.icon, { size: 22, stroke: 1.75 }));
      }
      btn.appendChild(K.dom.el('span', { cls: 'k-tabbar__label', text: s.label }));

      btn.addEventListener('click', () => K.router.go(s.path));

      tabbar.appendChild(btn);
    }

    return tabbar;
  };

  const updateTabbarActive = (path) => {
    const tabbar = document.getElementById('khayal-tabbar');
    if (!tabbar) return;
    const map = {
      '/home': 'home',
      '/explore': 'explore',
      '/compose': 'compose',
      '/notifications': 'notifications',
      '/messages': 'messages',
    };
    let active = map[path];
    // داخل مسارات فرعية
    if (!active) {
      if (path.startsWith('/post/')) active = 'home';
      if (path.startsWith('/u/')) active = null;
      if (path.startsWith('/tag/')) active = 'explore';
      if (path.startsWith('/settings')) active = null;
    }
    tabbar.querySelectorAll('.k-tabbar__item').forEach(item => {
      const isActive = item.dataset.section === active;
      item.setAttribute('aria-selected', isActive ? 'true' : 'false');
      item.dataset.active = isActive ? 'true' : 'false';
    });
  };

  /* ═══════════════════════════════════════════════════════════
     الربط بحالة شريط التنقّل — العدّادات
     ═══════════════════════════════════════════════════════════ */

  const bindBadges = () => {
    // الإشعارات
    K.store.subscribe('notifications.unread', (n) => {
      K.overlays.setTabbarBadge('notifications', n);
    }, { immediate: true });

    // الرسائل
    K.store.subscribe('messages.unread', (n) => {
      K.overlays.setTabbarBadge('messages', n);
    });
  };

  /* ═══════════════════════════════════════════════════════════
     الربط بشبكة الأحداث
     ═══════════════════════════════════════════════════════════ */

  const bindGlobalEvents = () => {
    // تحديث شريط التنقّل عند تغيير المسار
    K.router.on(({ to }) => {
      updateTabbarActive(to?.path || '/');
    });

    // رسائل حية — إشعار صوتي
    K.events.on(document, 'khayal:message-received', (evt) => {
      const meId = K.store.get('user')?.id;
      const senderId = evt.detail?.message?.senderId;
      if (senderId && senderId !== meId) {
        K.sound.tap();
      }
    });

    // رسالة إلى الخلفية (Native) عند تغيير الحالة
    K.store.subscribe('authStatus', (status) => {
      K.utils.tryCatch(() => {
        window.KhayalBridge?.postMessage?.(JSON.stringify({
          type: 'auth-status',
          status,
        }));
      });
    });

    // منع التصغير عند السحب في WebView (لمنع إيماءة Safari)
    document.addEventListener('gesturestart', (evt) => evt.preventDefault(), { passive: false });
  };

  /* ═══════════════════════════════════════════════════════════
     تجهيز الهيكل — بناء الجذر مرة واحدة
     ═══════════════════════════════════════════════════════════ */

  const buildAppShell = () => {
    const root = document.getElementById('khayal-root');
    if (!root) {
      console.error('[app] العنصر الجذري khayal-root غير موجود');
      return null;
    }

    // امسح أي شيء مسبق
    K.dom.clear(root);

    const app = K.dom.el('div', { cls: 'k-app' });
    const viewport = K.dom.el('div', { cls: 'k-app__viewport', attrs: { id: 'khayal-viewport' } });
    app.appendChild(viewport);
    runtime.viewport = viewport;

    // الشريط السفلي
    app.appendChild(buildTabbar());

    root.appendChild(app);

    // اربط العدّادات
    bindBadges();

    return app;
  };

  /* ═══════════════════════════════════════════════════════════
     شاشة التحميل — تظهر قبل أن يستقر المصير
     ═══════════════════════════════════════════════════════════ */

  const showBootLoader = () => {
    const root = document.getElementById('khayal-root');
    if (!root) return;

    K.dom.clear(root);
    const loader = K.dom.el('div', {
      attrs: {
        style: `
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: var(--k-space-4);
          background: var(--k-paper);
          z-index: 9999;
          transition: opacity 240ms ease;
        `,
        id: 'khayal-boot',
      },
    });

    const logo = K.dom.el('div', {
      attrs: {
        style: `
          font-family: var(--k-font-display);
          font-size: var(--k-fs-4xl);
          font-weight: 700;
          letter-spacing: -0.04em;
          color: var(--k-brand-600);
          margin-bottom: var(--k-space-3);
        `,
        text: 'خَيال',
      },
    });
    loader.appendChild(logo);

    const spinner = K.dom.el('div', { cls: 'k-spinner k-spinner--md' });
    loader.appendChild(spinner);

    root.appendChild(loader);
  };

  const hideBootLoader = () => {
    const loader = document.getElementById('khayal-boot');
    if (!loader) return;
    loader.style.opacity = '0';
    setTimeout(() => K.dom.remove(loader), 260);
  };

  /* ═══════════════════════════════════════════════════════════
     التمهيد الكامل
     ═══════════════════════════════════════════════════════════ */

  const boot = async () => {
    const startTs = performance.now();

    // 1) أظهر شاشة التحميل فوراً
    showBootLoader();

    // 2) انتظر النواة
    await K.ready();

    // 3) هيّئ الأداء أولاً (يضبط data-perf)
    await K.perf.init();

    // 4) هيّئ الحالة (تستعيد من التخزين)
    await K.store.init();

    // 5) هيّئ الأدوات الجانبية (سريعة)
    K.overlays.init();
    K.utils.tryCatch(() => K.content.init());
    K.utils.tryCatch(() => K.actions.init());

    // 6) الجلسة (قد تتطلب طلباً شبكياً)
    await K.api.init();
    await K.sessionFlow.init();

    // 7) هيّئ الـ API الاجتماعي والتحديثات الحية
    K.utils.tryCatch(() => K.social.init());

    // 8) اربط الأحداث العامة
    bindGlobalEvents();

    // 9) ابْن هيكل التطبيق
    buildAppShell();

    // 10) سجّل المسارات
    registerRoutes();

    // 11) ابدأ الراوتر — بعد كل شيء
    K.router.start();

    // 12) أخفِ شاشة التحميل
    hideBootLoader();

    const totalMs = performance.now() - startTs;
    console.info(`%cخَيال · جاهز في ${Math.round(totalMs)}ms`, 'color:#5b4ce6;font-weight:bold');

    // إبلاغ الجسر بالجاهزية
    K.utils.tryCatch(() => {
      window.KhayalBridge?.postMessage?.(JSON.stringify({
        type: 'ready',
        bootMs: Math.round(totalMs),
        perf: K.perf.tier,
      }));
    });
  };

  /* ═══════════════════════════════════════════════════════════
     معالجة الأخطاء العالمية
     ═══════════════════════════════════════════════════════════ */

  window.addEventListener('error', (evt) => {
    console.error('[global.error]', evt.error || evt.message);
    // في الإنتاج: أرسل لـ Sentry أو خدمة مشابهة
  }, { passive: true });

  window.addEventListener('unhandledrejection', (evt) => {
    console.error('[global.unhandled]', evt.reason);
  }, { passive: true });

  /* ═══════════════════════════════════════════════════════════
     الإقلاع
     ═══════════════════════════════════════════════════════════ */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  /* نهاية 10-app.js */
})();