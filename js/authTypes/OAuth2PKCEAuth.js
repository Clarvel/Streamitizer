import { Authentication } from "../authentication.js"
import { Browser } from "../browser.js"
import { DecodeUriQuery, EncodeDataURL } from "../utils.js"
import { WebRequest } from "../WebRequest.js"

const GenerateChallenge = () => String.fromCharCode(...crypto.getRandomValues(new Uint8Array(Math.round(43 + crypto.getRandomValues(new Uint8Array(1))[0]/3))).map(c => Math.floor(c * 66 / 256)).map(c => c + (c < 38 ? (c > 11 ? 53 : (c > 1 ? 46 : 45)) : (c < 65 ? (c > 38 ? 58 : 57) : 61))))	// generate code verifier: get a random 0-255 uint, use that to get a random range of 0-255 uints, 43-128 uints long, convert from 0-255 -> 0-66, convert from 0-66 -> ASCii char code range

const EncodeVerifier = async verifier => btoa(String.fromCharCode.apply(null, new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') // generate binary string challenge: generate unique digest, generate binary string from array buffer, create a Base64-encoded ASCII string from a binary string, and format to be URL safe

export class OAuth2PKCEAuth extends Authentication{
	constructor({"ClientID":clientID, "AuthenticationAPI":authenticationAPI, "TokenAPI":tokenAPI, "Scopes":scopes, "PKCE":PKCE}){
		super(arguments)
		this.ClientID = clientID
		this._authURI = authenticationAPI
		this._tokenURI = tokenAPI
		this._scopes = scopes
		this._PKCE = PKCE ?? true

		this._OAUTH_PROMISE = null
	}

	_RefreshAccessToken(payload){return WebRequest.POST(this._tokenURI, {body: payload, headers: {"Content-Type": "application/x-www-form-urlencoded"}})}

	async Authenticate(manuallyTriggered=false){
		return this._OAUTH_PROMISE ??= (async () => {
			//console.log("Initiating OAuth")
			const verifier = GenerateChallenge()
			//console.log("Launching Web Auth flow")
			const request = {
				"redirect_uri":Browser.ExtensionRedirectURI(),
				"response_type":this._tokenURI ? "code" : "token", // or "token" for implicit flow
				"scope":this._scopes.join(' '),
				"client_id":this.ClientID,
				"state":verifier // used for self-verification
			}
			if(this._tokenURI && this._PKCE){
				request["code_challenge"] = await EncodeVerifier(verifier), // used for server-verificaiton
				request["code_challenge_method"] = "S256"
			}
			if(manuallyTriggered)
				request["force_verify"] = true
			const redirectUri = await Browser.LaunchWebAuthFlow(EncodeDataURL(this._authURI, request), manuallyTriggered)
			//console.log(redirectUri)
			let query = DecodeUriQuery(redirectUri)
			if(verifier !== query["state"]) throw Error("Received an invalid state while trying to init OAuth2 flow.")
			if(!this._tokenURI) return query//{"access_token":query["access_token"], "token_type":query["token_type"]}
			//console.log("Parsing Redirect from OAuth:", query)
			const parsed = query["code"] // find the code string used to verify
			if(parsed == null) throw Error("OAuth2 failed to parse an access code: " + redirectUri)
			return this._RefreshAccessToken({
				"client_id":this.ClientID,
				"grant_type":"authorization_code",
				"redirect_uri":Browser.ExtensionRedirectURI(),
				"code":parsed,
				"code_verifier":verifier
			})
		})().finally(() => this._OAUTH_PROMISE = null)
	}

	async Refresh(auth){
		return this._RefreshAccessToken({
			"client_id":this.ClientID,
			"grant_type":"refresh_token",
			"refresh_token":auth["refresh_token"] ?? auth["access_token"]
		})
	}
}