import { Controller, Get, Headers, HttpException, Inject, Optional, Post, Query, Res } from '@nestjs/common';
import { BROWSER_SESSION, BrowserSessionError, type BrowserSessionPort } from '../ports/browser-session';
import { AUTH_CONTEXT_RESOLVER, type AuthContextResolver } from '../ports/auth';
import { SYNTHETIC_PILOT_MODE } from '../ports/pilot-mode';

interface SessionReply { header(name: string, value: string | readonly string[]): SessionReply; code(status: number): SessionReply; send(body?: unknown): unknown }
@Controller('auth')
export class BrowserSessionController {
  constructor(@Inject(BROWSER_SESSION) private readonly sessions: BrowserSessionPort,
    @Inject(AUTH_CONTEXT_RESOLVER) private readonly auth: AuthContextResolver,
    @Optional() @Inject(SYNTHETIC_PILOT_MODE) private readonly syntheticOnly = false) {}

  @Get('login')
  login(@Query('workspace') workspace: string | undefined, @Res() reply: SessionReply) {
    try { return this.redirect(reply, this.sessions.begin(workspace)); } catch (error) { throw this.failure(error); }
  }
  @Get('callback')
  async callback(@Query() query: { code?: string; state?: string; error?: string }, @Headers() headers: Record<string, string | undefined>, @Res() reply: SessionReply) {
    try { return this.redirect(reply, await this.sessions.complete(query, headers)); } catch (error) { throw this.failure(error); }
  }
  @Get('session')
  session(@Headers() headers: Record<string, string | undefined>, @Res() reply: SessionReply) {
    return reply.header('Cache-Control', 'no-store').send({ ...this.sessions.view(headers, this.auth.resolve({ headers })), syntheticOnly: this.syntheticOnly });
  }
  @Post('logout')
  logout(@Headers() headers: Record<string, string | undefined>, @Res() reply: SessionReply) {
    return reply.header('Cache-Control', 'no-store').header('Set-Cookie', this.sessions.logout(headers)).code(204).send();
  }
  private redirect(reply: SessionReply, result: { location: string; cookies: readonly string[] }) {
    return reply.header('Cache-Control', 'no-store').header('Referrer-Policy', 'no-referrer')
      .header('Set-Cookie', result.cookies).header('Location', result.location).code(302).send();
  }
  private failure(error: unknown) {
    return new HttpException({ code: error instanceof BrowserSessionError ? error.code : 'LOGIN_UNAVAILABLE', message: 'Sign in could not be completed.' },
      error instanceof BrowserSessionError ? error.status : 503);
  }
}
