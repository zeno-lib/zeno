import { DialogTitle } from "@zeno-lib/ui/dialog"

export const AboutMagicLinks = () => (
  <>
    <DialogTitle className="font-medium text-lg">
      Why is it better not to use a password?
    </DialogTitle>
    <p>
      At Bridge Capital, the security and privacy of our users are taken
      extremely seriously. We know you place your trust in us by sharing
      personal and sensitive information, and we do everything we can to protect
      it.
    </p>
    <p>
      Our main objective is to make it impossible for an intruder to log in on
      your behalf!
    </p>
    <p>
      To ensure this, we try to avoid using passwords for authentication. Here’s
      why:
    </p>
    <p>
      Passwords are one of the biggest security risks on the internet, because
      many people reuse them across multiple websites. We get it, it’s hard to
      remember them all! But it only takes one of those sites being hacked for
      your precious password to fall into the hands of attackers.
    </p>
    <p>
      That’s why we use a passwordless solution, which requires you to click on
      a “magic” link we send to you by email each time you log in on a new
      device.
    </p>
    <p>
      This solution is certainly not less secure than a password, after all,
      every password-based website lets you recover a forgotten password by
      clicking a magic link in an email. It’s actually more secure, because it
      prevents you from reusing a password that may already be compromised.
    </p>
    <p>
      PS: At Bridge Capital, to secure our passwords on sites that still require
      them, we use and recommend 1Password.
    </p>
  </>
)
