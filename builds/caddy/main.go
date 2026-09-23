package main

import (
	_ "time/tzdata"

	caddycmd "github.com/caddyserver/caddy/v2/cmd"

	// plug in Caddy modules here
	_ "github.com/caddyserver/caddy/v2/modules/standard"
	_ "github.com/caddy-dns/cloudflare"
	_ "github.com/ggicci/caddy-jwt"
	_ "github.com/greenpau/caddy-security"
	_ "github.com/mholt/caddy-l4"
)

func main() {
	caddycmd.Main()
}
