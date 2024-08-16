import { NextResponse } from "next/server";

function authMiddleware(req) {
	const loginPath = "/login";
	const { pathname } = req.nextUrl;
	console.log(pathname);

	const token = req.cookies.get("token");

	if (pathname === loginPath) {
		if (token) {
			return NextResponse.redirect(new URL("/", req.url));
		} else {
			return NextResponse.next();
		}
	}

	if (!token) {
		return NextResponse.redirect(new URL(loginPath, req.url));
	}

	return NextResponse.next();
}

export function middleware(req) {
	return authMiddleware(req);
}

export const config = {
	matcher: [ "/((?!_next/static|_next/image|favicon.ico).*)" ],
};
