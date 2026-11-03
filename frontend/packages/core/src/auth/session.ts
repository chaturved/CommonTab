import type { Api, Session } from '../api';

/** Where the access token lives: Keychain/Keystore on mobile, memory or a cookie on web. Never localStorage. */
export interface TokenStore {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  clear(): Promise<void>;
}

export class MemoryTokenStore implements TokenStore {
  private token: string | null = null;
  get = async () => this.token;
  set = async (token: string) => { this.token = token; };
  clear = async () => { this.token = null; };
}

export interface SignedInUser { id: string; email: string; name: string }

export class AuthSession {
  user: SignedInUser | null = null;

  constructor(private readonly api: Api, private readonly tokens: TokenStore) {}

  async signIn(email: string, password: string): Promise<SignedInUser> {
    return this.accept(await this.api.login({ email, password }));
  }

  async register(email: string, name: string, password: string): Promise<SignedInUser> {
    return this.accept(await this.api.register({ email, name, password }));
  }

  async signOut(): Promise<void> {
    try { await this.api.logout(); } catch { /* the token is dropped locally either way */ }
    await this.tokens.clear();
    this.user = null;
  }

  private async accept(session: Session): Promise<SignedInUser> {
    await this.tokens.set(session.accessToken);
    this.user = session.user;
    return session.user;
  }
}
