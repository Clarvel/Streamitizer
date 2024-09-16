import { SetElemOrString, GetI18nText, PromiseAll } from "../utils.js"

const BASE_ELEM = document.getElementById("modal")
const BOOTSTRAP = bootstrap.Modal.getOrCreateInstance(BASE_ELEM)
const TITLE_ELEM = document.getElementById("modalTitle")
const BODY_ELEM = document.getElementById("modalBody")
const PRIMARY_BUTTON = document.getElementById("modalAccept")
const SECONDARY_BUTTON = document.getElementById("modalClose")

let CALLBACK = null

async function ModalCallback(evt, wasAccepted){
    if(CALLBACK){
        PRIMARY_BUTTON.setAttribute("disabled", "")
        SECONDARY_BUTTON.setAttribute("disabled", "")
        try{
            await CALLBACK(evt, wasAccepted)
        }catch(e){
            console.warn(e)
            BASE_ELEM.addEventListener("hidden.bs.modal", () => DisplayErrorModal(e.message), {once:true}) // wait for modal to fade
        }
    }
    BOOTSTRAP.hide()
}

export async function DisplayModal(title, primaryButton, message=null, secondaryButton=null, callback=null){
    CALLBACK = callback
    PRIMARY_BUTTON.removeAttribute("disabled")
    SECONDARY_BUTTON.removeAttribute("disabled")

    await PromiseAll([[TITLE_ELEM, title], [BODY_ELEM, message], [PRIMARY_BUTTON, primaryButton], [SECONDARY_BUTTON, secondaryButton]].map(async ([elem, promise])=>{
        const content = await promise
        elem.style.display = content ? null : "none"
        SetElemOrString(elem, content ?? "")
    }))

    BOOTSTRAP.show()
}

export const DisplayErrorModal = async (message, callback=null) => DisplayModal(GetI18nText("error"), GetI18nText("ok"), message, null, callback)

PRIMARY_BUTTON.addEventListener("click", async (e)=>{await ModalCallback(e, true)})
SECONDARY_BUTTON.addEventListener("click", async (e)=>{await ModalCallback(e, false)})