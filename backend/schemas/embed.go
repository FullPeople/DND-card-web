package schemas

import "embed"

//go:embed character/*.json protocol/*.json
var Files embed.FS
