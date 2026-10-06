# Kihiihi Community Church

This site includes public church pages, member accounts, and an administrator workspace. Registration and authentication use Netlify Identity. Videos, sermons, and events are stored in Netlify Database rather than browser storage or files in the repository.

## Member accounts

Use **Log in / Register** in the navigation, or visit `/account.html`. Members can register with their name, email address, and password, confirm their email, log in, log out, edit their name, and recover a forgotten password. Confirmation, recovery, and invitation links are handled even when they initially open the homepage. Watching videos and browsing events do not require an account.

Netlify Identity was enabled for this project. Registration is open by default, and email confirmation is required unless the site owner changes that setting. Review registration, email delivery, and the site URL in the project's Identity settings before inviting the congregation.

## Set up the first administrator

1. In the Netlify dashboard, open this project's **Identity** section.
2. Invite the intended administrator, or locate their existing registered account. Complete the email confirmation or invitation flow.
3. Open that user's details, add `admin` in the **Roles** field, and save.
4. Log out and log back in on the website, then open **Admin** in the navigation or visit `/admin.html`.

The first administrator must be assigned by the site owner through Netlify, not through public registration. Registration never grants admin privileges. Subsequent administrators can grant or remove the admin role for other users from **User accounts** in the workspace. They can also list users and permanently delete other accounts. Administrators cannot delete their own account or remove their own role in the workspace.

The workspace page itself is a static shell and contains no private records. Its data and all management actions require server-side authentication, a current Identity admin role, and same-origin checks on changes. Role revocations are checked against the current Identity user record rather than relying only on an old session's role claims.

## Add social videos and church content

1. Log in as an administrator and open **Videos & church content**.
2. Choose **Social video**, **Sermon**, or **Event**.
3. Add a title and optional description. For videos and sermons, paste the public video URL. For events, choose the local date and time and optionally add a location.
4. Leave **Publish on the website** checked to make the item public, or uncheck it to save a private draft.
5. Save the item. Use **Edit** or **Delete** in the library to manage existing items.

Published social videos appear on `/online.html`; sermons appear on `/sermons.html`; events appear on `/events.html` alongside the existing recurring gatherings. Event times are entered using the administrator's device time zone, stored as timestamps, and displayed in each visitor's local time zone.

Supported video URLs:

- YouTube: a watch, short-link, Shorts, or individual livestream URL, not a channel page.
- Facebook: a public video, Reel, watch link, or supported share link, not a profile page.
- Instagram: a public post or Reel URL. The account must allow embedding.
- TikTok: the full `https://www.tiktok.com/@username/video/VIDEO_ID` URL. Open shortened share links on TikTok first and copy the full link.

Paste links, not iframe HTML, embed scripts, social platform passwords, or API credentials. Visitors choose **Load video** before a third-party player is loaded. Each video also includes an original-platform link because privacy settings, age restrictions, disabled embedding, tracking protection, or platform changes can prevent embedded playback. This is a curated library of selected links, not an automatic social feed or a video upload service.

## Development and deployment

Install dependencies with `npm ci`. Use `npm run check` for TypeScript validation. For local platform emulation, use Netlify CLI with `netlify dev --port 8889`.

Netlify runs the configured build automatically. The deployment copies the static pages into `dist`, bundles the browser's Identity client, and deploys the API functions. Do not expose dependency files or server code through the public directory.

The database schema is defined in `db/schema.ts`, with Drizzle configuration in `drizzle.config.ts`. The initial migration is included under `netlify/database/migrations` and is applied by the platform during deployment. Database provisioning happens on first connection. No database credentials need to be added to the browser.

After deployment, verify registration and confirmation with a real email address, password recovery, first-admin access, content publication, private draft visibility, and playback of your actual social video links. Email delivery and third-party embedding cannot be fully validated by isolated local checks.
