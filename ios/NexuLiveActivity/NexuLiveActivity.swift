import ActivityKit
import WidgetKit
import SwiftUI

// ── Modelo de datos del Live Activity ──────────────────────────────────────
struct NexuPIXAttributes: ActivityAttributes {
    public typealias NexuPIXStatus = ContentState

    public struct ContentState: Codable, Hashable {
        var estado: String      // "esperando" | "confirmado" | "error"
        var monto: String       // "R$ 15,00"
        var mensagem: String    // texto mostrado al usuario
    }

    var userId: String
    var nome: String
}

// ── Vista del Live Activity ─────────────────────────────────────────────────
struct NexuLiveActivityView: View {
    let context: ActivityViewContext<NexuPIXAttributes>

    var body: some View {
        HStack(spacing: 12) {
            // Ícono de estado
            ZStack {
                Circle()
                    .fill(colorEstado)
                    .frame(width: 36, height: 36)
                Image(systemName: iconoEstado)
                    .foregroundColor(.white)
                    .font(.system(size: 16, weight: .bold))
            }

            VStack(alignment: .leading, spacing: 2) {
                Text("Nexu")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(.secondary)
                Text(context.state.mensagem)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(.primary)
            }

            Spacer()

            Text(context.state.monto)
                .font(.system(size: 15, weight: .black))
                .foregroundColor(colorEstado)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }

    var colorEstado: Color {
        switch context.state.estado {
        case "confirmado": return Color(red: 0.18, green: 0.80, blue: 0.44)  // verde
        case "error":      return Color(red: 0.91, green: 0.47, blue: 0.35)  // coral
        default:           return Color(red: 0.18, green: 0.83, blue: 0.75)  // teal
        }
    }

    var iconoEstado: String {
        switch context.state.estado {
        case "confirmado": return "checkmark.circle.fill"
        case "error":      return "xmark.circle.fill"
        default:           return "clock.fill"
        }
    }
}

// ── Widget Extension entry point ────────────────────────────────────────────
@main
struct NexuLiveActivityBundle: WidgetBundle {
    var body: some Widget {
        NexuLiveActivityWidget()
    }
}

struct NexuLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: NexuPIXAttributes.self) { context in
            // Pantalla de bloqueo y notificación expandida
            NexuLiveActivityView(context: context)
                .background(Color(.systemBackground))
        } dynamicIsland: { context in
            DynamicIsland {
                // Vista expandida (usuario toca la pastilla)
                DynamicIslandExpandedRegion(.leading) {
                    HStack {
                        Image(systemName: "brazilianrealsign.circle.fill")
                            .foregroundColor(.green)
                        Text("PIX")
                            .font(.headline)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.state.monto)
                        .font(.headline.bold())
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(context.state.mensagem)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
            } compactLeading: {
                // Vista compacta izquierda
                Image(systemName: "brazilianrealsign.circle.fill")
                    .foregroundColor(.green)
                    .font(.system(size: 14))
            } compactTrailing: {
                // Vista compacta derecha — estado
                Text(context.state.estado == "confirmado" ? "✓" : "...")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(context.state.estado == "confirmado" ? .green : .orange)
            } minimal: {
                // Vista mínima (solo un punto)
                Image(systemName: context.state.estado == "confirmado"
                    ? "checkmark.circle.fill"
                    : "clock.fill")
                    .foregroundColor(context.state.estado == "confirmado" ? .green : .orange)
            }
        }
    }
}
