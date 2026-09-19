import { NextResponse } from 'next/server'

// Reemplazar "TEAMID" por el Apple Developer Team ID real (10 caracteres,
// visible en developer.apple.com/account → Membership, o vía `eas credentials`).
// Sin esto, los Universal Links (ios/Nexu/Nexu.entitlements → applinks:konexu.app)
// no van a abrir la app: iOS descarga este archivo por HTTPS al instalar la app
// y necesita que el Team ID coincida con el certificado de firma real.
const TEAM_ID = 'TEAMID'
const BUNDLE_ID = 'com.konexu.app'

export async function GET() {
  return NextResponse.json({
    applinks: {
      apps: [],
      details: [
        {
          appID: `${TEAM_ID}.${BUNDLE_ID}`,
          paths: ['*'],
        },
      ],
    },
  })
}
