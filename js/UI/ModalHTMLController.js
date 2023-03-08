import { RemoveChildren, SetElemOrString, IsStr, GetI18nText, PromiseAll } from "../utils.js"

export class ModalHTMLController{
    constructor(elemID, titleID, bodyID, primaryButtonID, secondaryButtonID, errTitleKey, errButtonKey){
        this._errTitleKey = errTitleKey
        this._errButtonKey = errButtonKey
        this._baseElem = document.getElementById(elemID)
        this._bootstrapModal = bootstrap.Modal.getOrCreateInstance(this._baseElem)
        this._title = document.getElementById(titleID)
        this._body = document.getElementById(bodyID)
        this._primaryButton = document.getElementById(primaryButtonID)
        this._secondaryButton = document.getElementById(secondaryButtonID)

        this._primaryButton.addEventListener("click", async (e)=>{await this._ModalCallback(e, true)})
	    this._secondaryButton.addEventListener("click", async (e)=>{await this._ModalCallback(e, false)})

        this._callback = null
        this._style = null
    }

    async _ModalCallback(evt, wasAccepted){
        if(this._callback != null){
            this._primaryButton.setAttribute("disabled", "")
            this._secondaryButton.setAttribute("disabled", "")
            try{
                await this._callback(evt, wasAccepted)
            }catch(e){
                console.warn(e)
                this._baseElem.addEventListener("hidden.bs.modal", ()=>{ // wait for modal to fade
                    const [title, body, primaryButton, secondaryButton] = [this._title, this._body, this._primaryButton, this._secondaryButton].map(e=>{
                        const frag = new DocumentFragment()
                        frag.append(...RemoveChildren(e))
                        return frag
                    })
                    const style = this._style
                    const cb = this._callback
                    
                    this.DisplayErrorModal(e.message, ()=>{
                        this._baseElem.addEventListener("hidden.bs.modal", ()=>{ // wait for error modal to fade
                            this.DisplayModal({
                                title:title,
                                contents:body,
                                primaryButton:primaryButton,
                                secondaryButton:secondaryButton,
                                callback:cb,
                                style:style
                            })
                        }, {once:true})
                    })
                }, {once:true})
            }
        }
        this._bootstrapModal.hide()
        //this._callback = null
    }
    
    DisplayErrorModal(message, callback=null){return this.DisplayModal({title:this._errTitleKey, primaryButton:this._errButtonKey, contents:message, callback:callback, style:"err"})}
    
    async DisplayModal({title=null, contents=null, primaryButton=null, secondaryButton=null, callback=null, style=null}){
        this._callback = callback
        this._style = style
        this._primaryButton.removeAttribute("disabled")
        this._secondaryButton.removeAttribute("disabled")

        await PromiseAll([[this._title, title], [this._body, contents], [this._primaryButton, primaryButton], [this._secondaryButton, secondaryButton]].map(async ([elem, promise])=>{
            const content = await ((IsStr(promise) && promise.charAt(2) === '_') ? GetI18nText(promise) ?? promise : promise)
            elem.style.display = content == null ? "none" : null
            SetElemOrString(elem, content ?? "")
        }))

        this._bootstrapModal.show()
    }
}