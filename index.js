(function() {
    'use strict';

    /**
     * Chat‑Exporter (HTML)
     * --------------------
     * 将 SillyTavern 对话导出为浏览器可读的 HTML 文件，保留 <table>/<pre>… 等富文本。
     */

    const CONFIG = {
        fileNameMaxLength: 30
    };

    /* ========== UI ========== */
    function addSettingsUI() {
        if (document.getElementById('chat-exporter-export-all')) return; // 已存在

        const html = `
        <div id="chat-exporter-settings" class="extension-settings">
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>📚 对话导出器 (HTML)</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content">
                    <div class="flex-container">
                        <div class="flex1">
                            <input id="chat-exporter-export-all" type="button" class="menu_button" value="导出当前对话为 HTML">
                        </div>
                    </div>
                    <small class="notes">将生成 3 个 HTML 文件：完整对话、用户对话、角色对话</small>
                </div>
            </div>
        </div>`;

        (document.querySelector('#extensions_settings2') ||
         document.querySelector('#extensions_settings')  ||
         document.querySelector('.extensions_settings'))?.insertAdjacentHTML('beforeend', html);

        document.getElementById('chat-exporter-export-all')?.addEventListener('click', exportChat);
    }

    /* ========== 主流程 ========== */
    async function exportChat() {
        toggleButton(true);
        try {
            const messages = collectMessages();
            if (!messages.length) return toast('没有找到对话消息');

            const processed = segregateByRole(messages);
            if (!Object.keys(processed.roleContents).length) return toast('没有找到有效的对话内容');

            saveFiles(processed);
            toast('导出完成！');
        } catch (err) {
            console.error('Chat‑Exporter error', err);
            toast('导出失败：' + err.message);
        } finally {
            toggleButton(false);
        }
    }

    /* ========== 消息采集 ========== */
    function collectMessages() {
        const chat = document.querySelector('#chat');
        if (!chat) return [];
        const list = [];
        chat.querySelectorAll('.mes').forEach(mes => {
            if (mes.classList.contains('is_system')) return; // 跳过系统
            const name = mes.querySelector('.name_text')?.textContent.trim() || (mes.classList.contains('is_user') ? 'User' : 'Assistant');
            const html = extractContentHTML(mes.querySelector('.mes_text'));
            if (html) list.push({ name, html });
        });
        return list;
    }

    /**
     * 提取单条消息 HTML，删除编辑按钮 / avatar 等不相关元素，但保留富文本结构。
     */
    function extractContentHTML(root) {
        if (!root) return '';
        const clone = root.cloneNode(true);
        clone.querySelectorAll([
            'script','style','noscript',
            '.timestamp','.message-id',
            '.edit-controls','.mes_edit_buttons',
            '.mes_buttons','.swipe-controls',
            '.avatar','.mes_edit_cancel',
            '.mes_edit_save','.mes_edit_delete',
            'StatusBlock','details statusblock'
        ].join(',')).forEach(el => el.remove());

        // 简易清理空行 &nbsp;→ space
        let html = clone.innerHTML.replace(/&nbsp;/g,' ');
        return html.trim();
    }

    /* ========== 数据分组 ========== */
    function segregateByRole(messages) {
        const roleContents = {};
        const fullContent = [];

        messages.forEach(({name, html}) => {
            fullContent.push({ name, html });
            (roleContents[name] ||= []).push(html);
        });

        return { roleContents, fullContent };
    }

    /* ========== 文件输出 ========== */
    function saveFiles({ roleContents, fullContent }) {
        const t = new Date().toISOString().slice(0,19).replace(/:/g,'-');
        const roles = Object.keys(roleContents);
        const user  = roles[0] || 'User';
        const bot   = roles[1] || 'Assistant';

        // 每角色一文件
        roles.forEach(r => {
            const body = roleContents[r].map(block => `<div class="msg">${block}</div>`).join('\n');
            writeFile(`${safe(r)}_dialog_${t}.html`, wrapHtml(`${r} 对话`, body));
        });

        // 完整对话
        const fullBody = fullContent.map(({name, html}) => `<div class="msg"><span class="role">${name}:</span> ${html}</div>`).join('\n');
        writeFile(`${safe(user)}_and_${safe(bot)}_full_dialog_${t}.html`, wrapHtml(`${user} & ${bot} 完整对话`, fullBody));
    }

    function wrapHtml(title, body) {
        return `<!DOCTYPE html><html lang="zh‑CN"><head><meta charset="utf-8"><title>${title}</title><style>
            body{font-family:Inter,\"Noto Sans SC\",sans-serif;margin:0;padding:1.5em;line-height:1.6;background:#fff;color:#222;}
            .msg{margin-bottom:1.2em;}
            .role{font-weight:600;margin-right:.3em;}
            table{border-collapse:collapse;width:100%;margin:1em 0;}
            th,td{border:1px solid #ccc;padding:.4em;vertical-align:top;}
            pre{background:#f7f7f7;padding:.6em;border-radius:4px;overflow:auto;}
            code{background:#f5f5f5;padding:.1em .3em;border-radius:3px;}
        </style></head><body>${body}</body></html>`;
    }

    function writeFile(name, content) {
        const blob = new Blob([content], { type:'text/html;charset=utf-8' });
        const url  = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement('a'), { href:url, download:name, style:'display:none' });
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    }

    /* ========== 工具 ========== */
    const toast = msg => (typeof toastr!=='undefined'?toastr.info(msg):alert(msg));

    function safe(str){return str.replace(/[\\/*?:"<>|]/g,'_').slice(0,CONFIG.fileNameMaxLength).trim();}

    function toggleButton(disabled){
        const btn=document.getElementById('chat-exporter-export-all');
        if(!btn)return;
        if(disabled){btn.dataset.txt=btn.value;btn.disabled=true;btn.value='处理中…';}
        else{btn.disabled=false;btn.value=btn.dataset.txt||'导出当前对话为 HTML';}
    }

    /* ========== 初始化 ========== */
    function init(){setTimeout(addSettingsUI,1000);} // 等 DOM 稳定

    function waitForST(){
        const t0=Date.now();
        const timer=setInterval(()=>{
            if(document.querySelector('#extensions_settings2, #extensions_settings')){clearInterval(timer);init();}
            if(Date.now()-t0>30000){clearInterval(timer);init();} // 兜底
        },500);
    }

    document.readyState==='loading'?document.addEventListener('DOMContentLoaded',waitForST):waitForST();

})();
