import { EncodeDataURL, EncodeQuery } from "./utils.js"

export type WebRequestOptions={
    query?:Object
    body?:Object
    headers?:Object
    responseType?:any
}

export class WebRequest{
	static async Fetch<T>(uri: string | URL, method: string, options?:WebRequestOptions): Promise<T>{
		let requestOptions = {"method":method}
		if(options?.body != null)
			requestOptions["body"] = EncodeQuery(options.body)
		if(options?.headers != null)
			requestOptions["headers"] = options.headers

        uri = uri.toString() // convert URL to string

		const response = await fetch(options?.query ? EncodeDataURL(uri, options.query) : uri, requestOptions)

		if(!response.ok){
			throw Error(`Network request failed with status ${response.status} ${response.statusText}: [${await response.text().catch()}]`)
		}

		if(typeof options?.responseType === 'string') // ugly hack because I can't switch on generic T eugh
			return await response.text() as T
			
		const json = await response.json()
		return options?.responseType ? json as T : json // ugly hack because I can't switch on generic T eugh
	}

	static POST<T>(uri: string, options?: WebRequestOptions): Promise<T>{
		return WebRequest.Fetch<T>(uri, "POST", options)
	}

	static GET<T>(uri: string, options?: WebRequestOptions): Promise<T>{
		if(options?.body != null)
			throw Error("GET request cannot have a 'body' option")
		return WebRequest.Fetch<T>(uri, "GET", options)
	}
}