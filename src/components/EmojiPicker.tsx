import { useTheme } from "@/theme";
import { fontSize, fontWeight } from "@/theme/typography";
import { spacing } from "@/theme/spacing";
import { useState, useMemo } from "react";
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

type EmojiItem = {
    emoji: string;
    keywords: string[];
};

const EMOJI_CATALOG: { category: string; icon: string; items: EmojiItem[] }[] = [
    {
        category: "Finanzas",
        icon: "wallet",
        items: [
            { emoji: "💰", keywords: ["dinero", "ahorro", "bolsa", "euros", "oro", "plata"] },
            { emoji: "💳", keywords: ["tarjeta", "credito", "debito", "visa", "mastercard", "pago", "banco"] },
            { emoji: "💵", keywords: ["billetes", "efectivo", "dolar", "cash"] },
            { emoji: "🏦", keywords: ["banco", "oficina", "prestamo", "cajero", "entidad"] },
            { emoji: "💼", keywords: ["trabajo", "nomina", "sueldo", "salario", "empleo", "jornada", "empresa"] },
            { emoji: "📈", keywords: ["inversiones", "bolsa", "fondos", "beneficio", "crecimiento"] },
            { emoji: "📉", keywords: ["perdida", "gasto", "bajada"] },
            { emoji: "🪙", keywords: ["moneda", "cripto", "bitcoin", "cambio"] },
            { emoji: "🧾", keywords: ["recibo", "factura", "ticket", "justificante"] },
            { emoji: "💎", keywords: ["lujo", "joya", "diamante", "ahorro"] },
            { emoji: "🛡️", keywords: ["seguro", "fondo", "emergencia", "proteccion", "colchon"] },
            { emoji: "🎯", keywords: ["meta", "hucha", "objetivo", "reto", "ahorrar"] },
            { emoji: "📊", keywords: ["grafico", "estadisticas", "analisis", "reporte"] },
            { emoji: "📑", keywords: ["contrato", "papeles", "gestoria", "hacienda", "impuestos"] },
            { emoji: "🪙", keywords: ["centimos", "propina", "monedas"] },
            { emoji: "🎁", keywords: ["regalo", "cumpleaños", "donacion", "premio", "navidad"] },
        ],
    },
    {
        category: "Comida & Ocio",
        icon: "restaurant",
        items: [
            { emoji: "🛒", keywords: ["supermercado", "mercadona", "compra", "carrefour", "lidl", "tienda"] },
            { emoji: "🍔", keywords: ["hamburguesa", "fast food", "mcdonalds", "burger", "comida"] },
            { emoji: "🍕", keywords: ["pizza", "cena", "italiano", "comida", "amigos"] },
            { emoji: "🍹", keywords: ["copas", "bar", "cocktail", "salidas", "fiesta", "noche"] },
            { emoji: "☕", keywords: ["cafe", "cafeteria", "desayuno", "starbucks"] },
            { emoji: "🍺", keywords: ["cerveza", "cañas", "terrazas", "bar", "tapas"] },
            { emoji: "🍷", keywords: ["vino", "cena", "restaurante", "bodega"] },
            { emoji: "🍣", keywords: ["sushi", "japones", "pescado", "asiatico"] },
            { emoji: "🌮", keywords: ["tacos", "mexicano", "comida"] },
            { emoji: "🥐", keywords: ["panaderia", "croissant", "pasteleria", "desayuno"] },
            { emoji: "🥩", keywords: ["carne", "carniceria", "asador", "barbacoa"] },
            { emoji: "🥑", keywords: ["fruta", "verdura", "aguacate", "saludable", "dieta"] },
            { emoji: "🍦", keywords: ["helado", "postre", "dulce"] },
            { emoji: "🍿", keywords: ["palomitas", "cine", "pelicula", "snacks"] },
            { emoji: "🍰", keywords: ["tarta", "cumpleaños", "dulces"] },
            { emoji: "🥪", keywords: ["bocadillo", "sandwich", "almuerzo", "merienda"] },
        ],
    },
    {
        category: "Transporte",
        icon: "car",
        items: [
            { emoji: "🚗", keywords: ["coche", "auto", "vehiculo", "transporte", "itv", "taller"] },
            { emoji: "⛽", keywords: ["gasolina", "diesel", "gasolinera", "repsol", "combustible", "deposito"] },
            { emoji: "🅿️", keywords: ["parking", "aparcamiento", "garaje", "estacionamiento"] },
            { emoji: "🚌", keywords: ["autobus", "bus", "transporte", "bonobus", "abono"] },
            { emoji: "🚇", keywords: ["metro", "subway", "tren", "renfe", "cercanias"] },
            { emoji: "✈️", keywords: ["avion", "vuelo", "viaje", "vacaciones", "aeropuerto"] },
            { emoji: "🚕", keywords: ["taxi", "uber", "cabify", "transporte"] },
            { emoji: "🛵", keywords: ["moto", "scooter", "ciclomotor"] },
            { emoji: "🚲", keywords: ["bici", "bicicleta", "carril bici", "transporte"] },
            { emoji: "🚆", keywords: ["ave", "tren", "renfe", "viaje"] },
            { emoji: "🚢", keywords: ["barco", "crucero", "ferry", "puerto"] },
            { emoji: "🧳", keywords: ["maleta", "viaje", "equipaje", "escapada"] },
            { emoji: "🏨", keywords: ["hotel", "alojamiento", "airbnb", "reserva"] },
            { emoji: "🗺️", keywords: ["mapa", "turismo", "viaje", "excursion"] },
            { emoji: "🛴", keywords: ["patinete", "electrico", "movilidad"] },
            { emoji: "🔧", keywords: ["mecanico", "taller", "reparacion", "rueda"] },
        ],
    },
    {
        category: "Hogar & Tech",
        icon: "home",
        items: [
            { emoji: "🏠", keywords: ["casa", "vivienda", "hipoteca", "alquiler", "piso", "hogar"] },
            { emoji: "💡", keywords: ["luz", "electricidad", "iberdrola", "endesa", "factura", "energia"] },
            { emoji: "💧", keywords: ["agua", "factura", "suministro", "canal"] },
            { emoji: "📶", keywords: ["internet", "fibra", "wifi", "router", "red"] },
            { emoji: "📱", keywords: ["movil", "telefono", "linea", "operador", "iphone"] },
            { emoji: "⚡", keywords: ["gas", "energia", "calefaccion", "luz"] },
            { emoji: "🧹", keywords: ["limpieza", "hogar", "productos", "orden"] },
            { emoji: "🛋️", keywords: ["muebles", "ikea", "decoracion", "salon", "sofa"] },
            { emoji: "💻", keywords: ["ordenador", "laptop", "pc", "tecnologia", "hardware"] },
            { emoji: "🖥️", keywords: ["pantalla", "monitor", "setup"] },
            { emoji: "🎧", keywords: ["auriculares", "musica", "audio", "spotify"] },
            { emoji: "📺", keywords: ["television", "netflix", "tele", "streaming"] },
            { emoji: "🧺", keywords: ["lavanderia", "ropa", "tintoreria"] },
            { emoji: "🪴", keywords: ["plantas", "jardin", "decoracion", "flores"] },
            { emoji: "🔨", keywords: ["herramientas", "bricolaje", "reforma", "leroy merlin"] },
            { emoji: "📦", keywords: ["amazon", "paquete", "envio", "pedidos"] },
        ],
    },
    {
        category: "Deporte & Salud",
        icon: "fitness",
        items: [
            { emoji: "🎾", keywords: ["padel", "tenis", "pala", "indoor", "partido", "deporte"] },
            { emoji: "🏋️", keywords: ["gimnasio", "gym", "pesas", "fitness", "crossfit", "entrenamiento"] },
            { emoji: "⚽", keywords: ["futbol", "partido", "liga", "campo", "deporte"] },
            { emoji: "🏀", keywords: ["baloncesto", "basket", "deporte"] },
            { emoji: "🏃", keywords: ["running", "correr", "maraton", "atletismo"] },
            { emoji: "🚴", keywords: ["ciclismo", "bici", "entreno", "bicicleta"] },
            { emoji: "🏊", keywords: ["piscina", "natacion", "nadar"] },
            { emoji: "💊", keywords: ["farmacia", "medicamentos", "pastillas", "medico", "salud"] },
            { emoji: "🩺", keywords: ["medico", "consulta", "doctor", "clinica", "revision"] },
            { emoji: "🦷", keywords: ["dentista", "dientes", "ortodoncia", "limpieza bucal"] },
            { emoji: "🕶️", keywords: ["optica", "gafas", "sol", "lentillas", "vista"] },
            { emoji: "🧖", keywords: ["spa", "masaje", "relax", "bienestar", "sauna"] },
            { emoji: "💈", keywords: ["peluqueria", "barbero", "corte pelo", "estetica"] },
            { emoji: "🧘", keywords: ["yoga", "pilates", "meditacion", "estiramiento"] },
            { emoji: "🥊", keywords: ["boxeo", "artes marciales", "deporte"] },
            { emoji: "🧗", keywords: ["escalada", "montaña", "aventura"] },
        ],
    },
    {
        category: "Estilo & Ocio",
        icon: "happy",
        items: [
            { emoji: "🎮", keywords: ["videojuegos", "playstation", "xbox", "nintendo", "steam", "gaming"] },
            { emoji: "🎬", keywords: ["cine", "peliculas", "entradas", "estreno", "cartelera"] },
            { emoji: "🎵", keywords: ["musica", "spotify", "concierto", "canciones"] },
            { emoji: "🎟️", keywords: ["entradas", "espectaculo", "teatro", "evento"] },
            { emoji: "📚", keywords: ["libros", "lectura", "libreria", "novela", "estudios"] },
            { emoji: "🎓", keywords: ["universidad", "master", "curso", "matricula", "clases"] },
            { emoji: "👕", keywords: ["ropa", "camisa", "zara", "moda", "compras"] },
            { emoji: "👟", keywords: ["zapatillas", "zapatos", "calzado", "sneakers", "nike"] },
            { emoji: "👗", keywords: ["vestido", "ropa", "moda"] },
            { emoji: "🐾", keywords: ["mascota", "perro", "gato", "veterinario", "pienso"] },
            { emoji: "🐶", keywords: ["perro", "mascota", "animal"] },
            { emoji: "🐱", keywords: ["gato", "mascota", "animal"] },
            { emoji: "🎲", keywords: ["juegos de mesa", "ocio", "amigos"] },
            { emoji: "🏖️", keywords: ["playa", "verano", "vacaciones", "sol"] },
            { emoji: "Camping", keywords: ["camping", "tienda", "naturaleza"] },
            { emoji: "✨", keywords: ["varios", "otros", "general", "extra"] },
        ],
    },
];

interface EmojiPickerProps {
    open: boolean;
    onClose: () => void;
    onSelectEmoji: (emoji: string) => void;
}

export function EmojiPickerModal({
    open,
    onClose,
    onSelectEmoji,
}: EmojiPickerProps) {
    const { colors: c } = useTheme();
    const [selectedCat, setSelectedCat] = useState(0);
    const [searchQuery, setSearchQuery] = useState("");

    // Normalized search query
    const cleanQuery = searchQuery.trim().toLowerCase();

    const displayedEmojis = useMemo(() => {
        if (!cleanQuery) {
            return EMOJI_CATALOG[selectedCat].items.map((i) => i.emoji);
        }

        // Search through all items across all categories
        const matches: string[] = [];
        for (const cat of EMOJI_CATALOG) {
            for (const item of cat.items) {
                const matched =
                    item.emoji === cleanQuery ||
                    item.keywords.some((k) => k.includes(cleanQuery));
                if (matched && !matches.includes(item.emoji)) {
                    matches.push(item.emoji);
                }
            }
        }
        return matches;
    }, [selectedCat, cleanQuery]);

    return (
        <Modal
            visible={open}
            animationType="slide"
            transparent
            onRequestClose={onClose}
        >
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable
                    style={[
                        styles.sheet,
                        { backgroundColor: c.surface, borderColor: c.border },
                    ]}
                    onPress={(e) => e.stopPropagation()}
                >
                    {/* Drag Handle */}
                    <View style={styles.dragHandleWrapper}>
                        <View style={[styles.dragHandle, { backgroundColor: c.border }]} />
                    </View>

                    {/* Header */}
                    <View style={styles.header}>
                        <View>
                            <Text style={[styles.headerTitle, { color: c.text }]}>
                                Elige un icono
                            </Text>
                            <Text style={[styles.headerSubtitle, { color: c.textMuted }]}>
                                {cleanQuery
                                    ? `${displayedEmojis.length} resultado(s)`
                                    : EMOJI_CATALOG[selectedCat].category}
                            </Text>
                        </View>
                        <Pressable
                            style={[styles.closeBtn, { backgroundColor: c.track }]}
                            onPress={onClose}
                            hitSlop={12}
                        >
                            <Ionicons name="close" size={18} color={c.text} />
                        </Pressable>
                    </View>

                    {/* Smart Search Bar */}
                    <View style={[styles.searchBox, { backgroundColor: c.background, borderColor: c.border }]}>
                        <Ionicons name="search" size={16} color={c.textMuted} />
                        <TextInput
                            style={[styles.searchInput, { color: c.text }]}
                            placeholder="Buscar (ej. padel, comida, gasolina, gym)..."
                            placeholderTextColor={c.textMuted}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        {searchQuery.length > 0 && (
                            <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
                                <Ionicons name="close-circle" size={16} color={c.textMuted} />
                            </Pressable>
                        )}
                    </View>

                    {/* Category tabs (hidden when searching) */}
                    {!cleanQuery && (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.tabsContainer}
                        >
                            {EMOJI_CATALOG.map((cat, idx) => {
                                const isSelected = selectedCat === idx;
                                return (
                                    <Pressable
                                        key={cat.category}
                                        style={[
                                            styles.tab,
                                            {
                                                backgroundColor: isSelected
                                                    ? c.primary
                                                    : c.track,
                                            },
                                        ]}
                                        onPress={() => setSelectedCat(idx)}
                                    >
                                        <Text
                                            style={[
                                                styles.tabText,
                                                {
                                                    color: isSelected
                                                        ? "#FFFFFF"
                                                        : c.textMuted,
                                                    fontWeight: isSelected
                                                        ? fontWeight.bold
                                                        : fontWeight.medium,
                                                },
                                            ]}
                                        >
                                            {cat.category}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                    )}

                    {/* Emoji Grid (6 columns, compact & modern) */}
                    <ScrollView
                        contentContainerStyle={styles.gridContainer}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {displayedEmojis.length === 0 ? (
                            <View style={styles.noResultsBox}>
                                <Text style={[styles.noResultsText, { color: c.textMuted }]}>
                                    No se encontraron iconos para "{searchQuery}"
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.grid}>
                                {displayedEmojis.map((emoji, idx) => (
                                    <Pressable
                                        key={`${emoji}-${idx}`}
                                        style={({ pressed }) => [
                                            styles.emojiBtn,
                                            { backgroundColor: pressed ? c.track : "transparent" },
                                        ]}
                                        onPress={() => {
                                            onSelectEmoji(emoji);
                                            onClose();
                                        }}
                                    >
                                        <Text style={styles.emojiChar}>{emoji}</Text>
                                    </Pressable>
                                ))}
                            </View>
                        )}
                    </ScrollView>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "flex-end",
    },
    sheet: {
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderTopWidth: 1,
        maxHeight: "75%",
        paddingBottom: spacing.lg,
    },
    dragHandleWrapper: {
        alignItems: "center",
        paddingTop: 10,
        paddingBottom: 4,
    },
    dragHandle: {
        width: 40,
        height: 5,
        borderRadius: 3,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.xs,
        paddingBottom: spacing.sm,
    },
    headerTitle: {
        fontSize: fontSize.subtitle,
        fontWeight: fontWeight.bold,
    },
    headerSubtitle: {
        fontSize: fontSize.caption,
        marginTop: 1,
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
    },
    searchBox: {
        flexDirection: "row",
        alignItems: "center",
        marginHorizontal: spacing.lg,
        marginBottom: spacing.xs,
        paddingHorizontal: spacing.md,
        height: 42,
        borderRadius: 14,
        borderWidth: 1,
        gap: spacing.xs + 2,
    },
    searchInput: {
        flex: 1,
        fontSize: fontSize.body - 1,
    },
    tabsContainer: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        gap: spacing.xs + 2,
    },
    tab: {
        paddingHorizontal: spacing.md,
        paddingVertical: 7,
        borderRadius: 20,
    },
    tabText: {
        fontSize: fontSize.caption,
    },
    gridContainer: {
        paddingHorizontal: spacing.md,
        paddingTop: spacing.xs,
        paddingBottom: spacing.xl,
        minHeight: 220,
    },
    grid: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "flex-start",
    },
    emojiBtn: {
        width: "16.66%", // 6 columns
        aspectRatio: 1,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 12,
    },
    emojiChar: {
        fontSize: 26,
    },
    noResultsBox: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: spacing.xl,
    },
    noResultsText: {
        fontSize: fontSize.caption + 1,
    },
});
