package endpoints

import (
	"net/http"
	"time"

	"github.com/AliKefall/prothea/internal/utils"
)

const accessTokenLifetime = 15 * time.Minute

func setAccessTokenCookie(w http.ResponseWriter, r *http.Request, token string) {
	http.SetCookie(w, &http.Cookie{
		Name: "access_token", Value: token, Path: "/ws",
		Expires: time.Now().Add(accessTokenLifetime), MaxAge: int(accessTokenLifetime.Seconds()),
		HttpOnly: true, Secure: utils.ShouldUseSecureCookie(r), SameSite: http.SameSiteLaxMode,
	})
}

func clearAuthCookies(w http.ResponseWriter, r *http.Request) {
	secure := utils.ShouldUseSecureCookie(r)
	for _, cookie := range []*http.Cookie{{Name: "refresh_token", Path: "/"}, {Name: "access_token", Path: "/ws"}} {
		cookie.Value = ""
		cookie.MaxAge = -1
		cookie.HttpOnly = true
		cookie.Secure = secure
		cookie.SameSite = http.SameSiteLaxMode
		http.SetCookie(w, cookie)
	}
}
