export const toBase64Url = (bytes: Uint8Array) => {
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

export const fromBase64Url = (input: string) => {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4);
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    out[i] = raw.charCodeAt(i);
  }
  return out;
};

export const credentialToJson = (credential: PublicKeyCredential) => {
  const response = credential.response as AuthenticatorResponse;
  const base = {
    id: credential.id,
    type: credential.type,
    rawId: toBase64Url(new Uint8Array(credential.rawId))
  };

  if ("attestationObject" in response) {
    const att = response as AuthenticatorAttestationResponse;
    return {
      ...base,
      response: {
        clientDataJSON: toBase64Url(new Uint8Array(att.clientDataJSON)),
        attestationObject: toBase64Url(new Uint8Array(att.attestationObject))
      }
    };
  }

  const ass = response as AuthenticatorAssertionResponse;
  return {
    ...base,
    response: {
      clientDataJSON: toBase64Url(new Uint8Array(ass.clientDataJSON)),
      authenticatorData: toBase64Url(new Uint8Array(ass.authenticatorData)),
      signature: toBase64Url(new Uint8Array(ass.signature)),
      userHandle: ass.userHandle ? toBase64Url(new Uint8Array(ass.userHandle)) : null
    }
  };
};
