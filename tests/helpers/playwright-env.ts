import 'dotenv/config';

export const defaultBaseURL = 'https://qa.careerforce.link';

export function getBaseURL(): string {
  return process.env.BASE_URL ?? defaultBaseURL;
}

export function getHttpCredentials():
  { username: string; password: string } | undefined {
  return process.env.BASIC_AUTH_USER
    ? {
        username: process.env.BASIC_AUTH_USER,
        password: process.env.BASIC_AUTH_PASSWORD ?? '',
      }
    : undefined;
}

export const editorAuthFile = 'playwright/.auth/editor.json';
