import { OAuth2 } from "./OAuth2.js"
import { GenericAuthClient } from "./GenericAuthClient.js"

//TODO combine the generic oauth client into this

export class OAuth2PKCEAuth extends GenericAuthClient{
	static Type = "OAuth2PKCE"
	constructor({"ClientID":clientID, "AuthenticationAPI":authenticationAPI, "TokenAPI":tokenAPI, "Scopes":scopes, "PKCE":PKCE}){
		super()
		console.log(PKCE)
		this._oauth = new OAuth2(clientID, authenticationAPI, tokenAPI, scopes, PKCE)
	}

	async Authenticate(manuallyTriggered=false){
		//if(manuallyTriggered || !this.IsAuthenticated())
			return await this._oauth.InitOAuth(manuallyTriggered)
		//return await this._oauth.RefreshAccessToken(token)
	}

	async Refresh(token){return await this._oauth.RefreshAccessToken(token)}
}

