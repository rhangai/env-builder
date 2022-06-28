# Basic usage

Install using `yarn add @rhangai/env-builder`

Create a `template.env`

```env
APP_NAME=example-app
APP_PASSWORD={{util.random(16)}}
APP_HOST=myapp.example.com
APP_CONNECTION_URL=http://${APP_HOST}/data
```

Create a `.env.local`

```env
APP_HOST=myapp.localhost
```

Configure it using:

```sh
yarn run env-builder generate -t template.env -i .env.local -o .env
```

The generated output will be

```env
APP_NAME=example-app
APP_PASSWORD=somerandomdata12
APP_HOST=myapp.example.com
APP_CONNECTION_URL=http://myapp.localhost/data
```

# Guide

Now that you know what this library does, let's explain what each flag of the following command

```sh
yarn run env-builder generate -t template.env -i .env.local -o .env
```

The `-t/--template [file]` flag is the template option, it will use it as a base file to generate your .env, it will be also considered the first input file to set the environment variable values

The `-i/--input [file]` flag may be used to read and override the variables on the template, it can also have additional variables. You can use this flag multiple times on the same command.

The `-o/--output [file]` flag is used to write the environment file generated by this command.

The `--env-override-prefix <prefix>` flag is usually combined when using CI. It allows the variables to be overwritten by environment variables of the same name, but prefixed with `prefix`.

-   Example: When using `--env-override-prefix CI_OVERRIDE_` you can set the env `CI_OVERRIDE_APP_NAME=my-ci-app` to override the variable `APP_NAME`

# `package.json` mode

You can simplify the usage of the scripts simply by creating the `env-builder` entry on the package.json file

```js
{
	"devDependencies": {
		"@rhangai/env-builder": "^0.4.0"
	},
	"scripts": {
		"env": "env-builder generate --package --",
		"env:ci": "env-builder generate --package --env-override-prefix CI_OVERRIDE_ --"
	},
	"env-builder": {
		"template": "env/template.env",
		"output": ".env", // Or array [".env", "output/.env"]
		"local": ".env.local",
		"modes": {
			"dev": ["env/development.env"],
			"prod": ["env/production.env"]
		}
	}
}
```

And the running `yarn env`

# Context

The default context contains two main variables `util` and `env`

You can use it in an expression like:

```env
MY_ENV={{ env.OTHER_ENV + util.random(64) }}
```

Util:

-   util.random(n, alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFHIJKLMNOPQRSTUVXYZ\_'): Generates a random string of length n
-   util.randomBase64(n): N random bytes, base64 encoded
-   util.randomUrlSafeBase64(n): N random bytes, base64 encoded url safe
-   util.randomHex(n): N random bytes, hex encoded
