import { Browser } from "../browser.js"
import { DecodeUriQuery, EncodeDataURL } from "../utils.js"
import { WebRequest } from "../webRequest.js"


//TODO when response is a 401 (unauthorized), refresh access token and try again

export class OAuth2{
	static _GenerateChallenge(){
		// generate code verifier:
		console.log("Generating Challenge")
		let arr = new Uint8Array(1)
		window.crypto.getRandomValues(arr) // 0-255 int
		arr = new Uint8Array(Math.round(43 + arr[0]/3)) // 43-128 characters long
		window.crypto.getRandomValues(arr)

		return String.fromCharCode(...arr.map(c=>{
			c = Math.floor(c * 66 / 256)  // convert range from 0-255 to 0-66
			return c + (c < 38 ? (c > 11 ? 53 : (c > 1 ? 46 : 45)) : (c < 65 ? (c > 38 ? 58 : 57) : 61))  // add modifier to convert 0-66 numbers to ASCii char code ranges    
		}))
	}

	static async _EncodeVerifier(verifier){
		// generate binary string challenge:
		let hashed = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))  // generate unique digest
		let hashStr = String.fromCharCode.apply(null, new Uint8Array(hashed))  // generate binary string from array buffer
		return btoa(hashStr).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')  // create a Base64-encoded ASCII string from a binary string, and format to be URL safe
	}

	/**
	 * @param {string} clientID 
	 * @param {string} authenticationURI 
	 * @param {string} tokenURI 
	 * @param {Array<String>} scopes 
	 */
	constructor(clientID, authenticationURI, tokenURI, scopes=[], PKCE=true){
		this._clientID = clientID
		this._AuthURI = authenticationURI
		this._tokenURI = tokenURI
		this._scopes = scopes
		this._PKCE = PKCE

		this._OAUTH_PROMISE = null
		this._REFRESH_PROMISE = null
	}

	async InitOAuth(interactive=false){
		if(this._OAUTH_PROMISE == null){
			this._OAUTH_PROMISE = (async ()=>{
				console.log("Initiating OAuth")
				let verifier = OAuth2._GenerateChallenge()

				console.log("Launching Web Auth flow")
				let request = {
					"redirect_uri":Browser.ExtensionRedirectURI(),
					"response_type": this._tokenURI ? "code" : "token", // or "token" for implicit flow
					"scope":this._scopes.join(' '),
					"client_id":this._clientID,
					"state":verifier // used for self-verification
				}
				if(this._tokenURI && this._PKCE){
					let challenge = await OAuth2._EncodeVerifier(verifier)

					request["code_challenge"] = challenge, // used for server-verificaiton
					request["code_challenge_method"] = "S256"
				}
				if(interactive){
					request["force_verify"] = true
				}

				let redirectUri = await Browser.LaunchWebAuthFlow(EncodeDataURL(this._AuthURI, request), interactive)
				console.log(redirectUri)
				let query = DecodeUriQuery(redirectUri)
				if(verifier !== query["state"]){
					throw Error("Received an invalid state while trying to init OAuth2 flow.")
				}

				if(!this._tokenURI){
					return {"access_token":query["access_token"], "token_type":query["token_type"]}
				}

				console.log("Parsing Redirect from OAuth:", query)
				let parsed = query["code"]// find the code string used to verify

				if(parsed == null)
					throw Error("OAuth2 failed to parse an access code: " + redirectUri)

				return await this._RefreshAccessToken({
					"client_id":this._clientID,
					"grant_type": "authorization_code",
					"redirect_uri":Browser.ExtensionRedirectURI(),
					"code":parsed,
					"code_verifier":verifier
				})
			})()
			this._OAUTH_PROMISE.finally(()=>this._OAUTH_PROMISE = null)
		}
		return this._OAUTH_PROMISE
	}

	/**
	 * @param {*} refreshToken 
	 */
	RefreshAccessToken(refreshToken){
		return this._RefreshAccessToken({
			"grant_type":"refresh_token",
			"refresh_token":refreshToken,
			"client_id":this._clientID
		})
	}

	// do not set refreshToken unless you are refreshing the tokens
	_RefreshAccessToken(payload){
		console.log("Initiating AccessToken refresh with payload:", payload)
		return WebRequest.POST(
			this._tokenURI, {
				body: payload, 
				headers: {"Content-Type": "application/x-www-form-urlencoded"}
			}
		)
	}
}