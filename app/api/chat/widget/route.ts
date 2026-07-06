import { getBaseUrl } from '@/lib/base-url'
import { NextRequest, NextResponse } from 'next/server'

// One-line embed for client websites:
//   <script src="https://<crm-domain>/api/chat/widget?slug=ACCOUNT_SLUG" async></script>
// Injects a floating chat button that opens the public chat page in an iframe.
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug') ?? ''
  if (!/^[a-z0-9-]+$/i.test(slug)) {
    return new NextResponse('// invalid slug', { status: 400, headers: { 'Content-Type': 'application/javascript' } })
  }

  const chatUrl = `${getBaseUrl()}/chat/${slug}`
  const js = `(function(){
  if (document.getElementById('scrm-chat-btn')) return;
  var open = false;

  var frame = document.createElement('iframe');
  frame.src = ${JSON.stringify(chatUrl)};
  frame.title = 'Live chat';
  frame.style.cssText = 'position:fixed;bottom:96px;right:20px;width:370px;height:540px;max-width:calc(100vw - 32px);max-height:calc(100vh - 120px);border:0;border-radius:16px;box-shadow:0 12px 40px rgba(2,6,23,.28);z-index:2147483646;display:none;background:#fff;';
  document.body.appendChild(frame);

  var btn = document.createElement('button');
  btn.id = 'scrm-chat-btn';
  btn.setAttribute('aria-label', 'Open live chat');
  btn.style.cssText = 'position:fixed;bottom:20px;right:20px;width:60px;height:60px;border-radius:50%;border:0;cursor:pointer;background:#4f46e5;box-shadow:0 8px 24px rgba(2,6,23,.3);z-index:2147483647;display:flex;align-items:center;justify-content:center;';
  var chatIcon = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  var closeIcon = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';
  btn.innerHTML = chatIcon;
  btn.onclick = function(){
    open = !open;
    frame.style.display = open ? 'block' : 'none';
    btn.innerHTML = open ? closeIcon : chatIcon;
  };
  document.body.appendChild(btn);
})();`

  return new NextResponse(js, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
