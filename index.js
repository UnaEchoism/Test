/*
 * ApV播放器｜轻量入口
 *
 * 这里只负责一件事：给 SillyTavern 注册播放器入口。
 * 播放器本体、歌单、设置、歌词 UI、音频解析等全部延迟到用户第一次打开时加载。
 */
(async function () {
    'use strict';

    let targetDoc = document;
    let targetWin = window;
    try {
        if (window.parent && window.parent !== window && window.parent.document &&
            window.parent.innerWidth > 0 && window.parent.innerHeight > 0) {
            targetDoc = window.parent.document;
            targetWin = window.parent;
        }
    } catch (_) {}

    const MENU_ID = 'arv_terminal_wand_container';
    const ITEM_ID = 'arvTerminalExtensionMenuItem';
    let runtimePromise = null;

    function runtimeUrl() {
        try {
            const src = document.currentScript?.src;
            if (src) return new URL('./apv-player-runtime.js', src).href;
        } catch (_) {}
        try {
            return new URL('./apv-player-runtime.js', targetWin.location.href).href;
        } catch (_) {
            return './apv-player-runtime.js';
        }
    }

    async function loadRuntime() {
        if (targetWin.__APV_PLAYER_RUNTIME__) return targetWin.__APV_PLAYER_RUNTIME__;
        if (!runtimePromise) {
            runtimePromise = (async () => {
                const res = await fetch(runtimeUrl(), { cache: 'no-store' });
                if (!res.ok) throw new Error(`播放器运行核心加载失败：HTTP ${res.status}`);
                const source = await res.text();
                // 运行核心只有在第一次点击后才执行。
                const execute = new Function(source);
                execute.call(targetWin);
                const runtime = targetWin.__APV_PLAYER_RUNTIME__;
                if (!runtime) throw new Error('播放器运行核心未正确初始化');
                return runtime;
            })().catch(err => {
                runtimePromise = null;
                console.error('[ApV播放器] 运行核心加载失败', err);
                try { targetWin.console?.error(err); } catch (_) {}
                throw err;
            });
        }
        return runtimePromise;
    }

    async function openPlayer() {
        const runtime = await loadRuntime();
        runtime.open();
    }

    function installMenu() {
        const menu = targetDoc.querySelector('#extensionsMenu');
        if (!menu) return false;

        targetDoc.getElementById(MENU_ID)?.remove();

        const container = targetDoc.createElement('div');
        container.id = MENU_ID;
        container.className = 'extension_container';

        const item = targetDoc.createElement('div');
        item.id = ITEM_ID;
        item.className = 'list-group-item flex-container flexGap5';
        item.title = '打开 播放器测试 音乐播放器';
        item.innerHTML = '<div class="fa-fw fa-solid fa-music extensionsMenuExtensionButton"></div><span>播放器测试</span>';
        item.onclick = event => {
            event.preventDefault();
            event.stopPropagation();
            openPlayer();
        };

        container.appendChild(item);
        menu.appendChild(container);
        return true;
    }

    // 酒馆菜单可能在脚本执行后才创建；这里只做一次极轻量的入口等待。
    if (!installMenu()) {
        let attempts = 0;
        const tryInstall = () => {
            if (installMenu() || ++attempts >= 5) return;
            targetWin.setTimeout(tryInstall, 800);
        };
        targetWin.setTimeout(tryInstall, 300);
    }

    // 保留旧版“显隐播放器”入口，但不加载播放器本体。
    if (typeof eventOn === 'function' && typeof getButtonEvent === 'function') {
        try {
            eventOn(getButtonEvent('显隐播放器'), async () => {
                const runtime = await loadRuntime();
                if (runtime.toggle) runtime.toggle();
                else runtime.open();
            });
        } catch (_) {}
    }
})();
