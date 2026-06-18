export const config = {
  matcher: '/:path*',
};

export default function middleware(request) {
  const host = request.headers.get('host') || '';
  const url = new URL(request.url);
  if (host === 'jinsungc.laundryops.co.kr' && url.pathname !== '/landing.html') {
    return Response.redirect(new URL('/landing.html', request.url), 307);
  }
}
