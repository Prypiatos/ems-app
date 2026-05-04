package utils

import "os"

// helper function for loading environment variables
func Getenv(key, def string) string {
	if res, ok := os.LookupEnv(key); ok {
		return res
	}
	return def
}
