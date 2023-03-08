import { Browser } from "../browser.js"
import { DecodeUriQuery, EncodeDataURL } from "../utils.js"
import { WebRequest, WebRequestOptions } from "../webRequest"

export class OAuth2<T>{
    private _clientID: string
    private _AuthURI: string
    private _tokenURI: string
    private _scopes: string[]
    private _PKCE: boolean
    private _OAUTH_PROMISE: Promise<T>|null
    private _config = {
        interactive:"force_verify"
    }
    
	private static _GenerateChallenge(){
		// generate code verifier:
		let arr = new Uint8Array(1)
		window.crypto.getRandomValues(arr) // 0-255 int
		arr = new Uint8Array(Math.round(43 + arr[0]/3)) // 43-128 characters long
		window.crypto.getRandomValues(arr)

		return String.fromCharCode(...arr.map(c=>{
			c = Math.floor(c * 66 / 256)  // convert range from 0-255 to 0-66
			return c + (c < 38 ? (c > 11 ? 53 : (c > 1 ? 46 : 45)) : (c < 65 ? (c > 38 ? 58 : 57) : 61))  // add modifier to convert 0-66 numbers to ASCii char code ranges    
		}))
	}

	private static async _EncodeVerifier(verifier: string){
		// generate binary string challenge:
		const hashed = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))  // generate unique digest
		const hashStr = String.fromCharCode.apply(null, new Uint8Array(hashed))  // generate binary string from array buffer
		return btoa(hashStr).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')  // create a Base64-encoded ASCII string from a binary string, and format to be URL safe
	}

	constructor(clientID: string, authenticationURI: string, tokenURI="", scopes=[], PKCE=true){
		this._clientID = clientID
		this._AuthURI = authenticationURI
		this._tokenURI = tokenURI
		this._scopes = scopes
		this._PKCE = PKCE
	}

	async InitOAuth(interactive=false){
		if(this._OAUTH_PROMISE == null){
			this._OAUTH_PROMISE = this._InitOAuth(interactive)
			this._OAUTH_PROMISE.finally(()=>this._OAUTH_PROMISE = null)
		}
		return this._OAUTH_PROMISE
	}

    private async _InitOAuth(interactive:boolean):Promise<T>{
        console.log("Initiating OAuth")
        const verifier = OAuth2._GenerateChallenge()

        console.log("Launching Web Auth flow")
        const request = {
            "redirect_uri":Browser.ExtensionRedirectURI(),
            "response_type": this._tokenURI ? "code" : "token",
            "scope":this._scopes.join(' '),
            "client_id":this._clientID,
            "state":verifier // used for self-verification
        }
        if(this._tokenURI && this._PKCE){
            request["code_challenge"] = await OAuth2._EncodeVerifier(verifier), // used for server-verificaiton
            request["code_challenge_method"] = "S256"
        }
        if(interactive){
            request[this._config.interactive] = true
        }

        const redirectUri = await Browser.LaunchWebAuthFlow(EncodeDataURL(this._AuthURI, request), interactive)
        //console.log(redirectUri)
        const response = DecodeUriQuery(redirectUri)
        if(verifier !== response["state"]){
            throw Error("Received an invalid state while trying to init OAuth2 flow.")
        }

        if(!this._tokenURI){ // if no token API we're in implicit flow
            return response as T
        }

        console.log("Parsing Redirect from OAuth:", response)
        let parsed = response["code"]// find the code string used to verify

        if(parsed == null)
            throw Error("OAuth2 failed to parse an access code: " + redirectUri)

        return await this._RefreshAccessToken({
            "client_id":this._clientID,
            "grant_type": "authorization_code",
            "redirect_uri":Browser.ExtensionRedirectURI(),
            "code":parsed,
            "code_verifier":verifier
        })
    }

	RefreshAccessToken(refreshToken: any){
        // if no token API we're in implicit flow
		return this._tokenURI ? this._RefreshAccessToken({
			"client_id":this._clientID,
			"grant_type":"refresh_token",
			"refresh_token":refreshToken,
		}) : this.InitOAuth()
	}

	private _RefreshAccessToken(payload: Object){
		console.log("Initiating AccessToken refresh with payload:", payload)
		return WebRequest.POST<T>(
			this._tokenURI, {
				body: payload, 
				headers: {"Content-Type": "application/x-www-form-urlencoded"}
			}
		)
	}
}