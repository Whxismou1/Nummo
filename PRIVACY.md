# Política de Privacidad de Nummo

**Última actualización:** 29 de septiembre de 2026

Nummo ("la Aplicación", "nosotros") es una aplicación de finanzas personales diseñada con un enfoque prioritario en la privacidad del usuario y la arquitectura *offline-first*.

Esta Política de Privacidad describe cómo recopilamos, utilizamos y protegemos su información cuando utiliza nuestra aplicación móvil y los servicios asociados.

---

## 1. Información que recopilamos

### a. Información de la cuenta de Google (OAuth)
Cuando inicia sesión con Google en Nummo, solicitamos acceso a:
- **Dirección de correo electrónico**: Utilizada exclusivamente como identificador de su cuenta y para la sincronización de sus datos en la nube.
- **Nombre y foto de perfil básica**: Utilizados únicamente para personalizar su experiencia en la interfaz de la aplicación.

*Nummo no solicita, accede ni almacena contraseñas de su cuenta de Google ni ningún otro dato personal o sensible ajeno al perfil básico.*

### b. Datos financieros y de uso
Los datos que introduce en la aplicación (transacciones, categorías, presupuestos y metas de ahorro) se almacenan principalmente de forma local en su dispositivo mediante una base de datos SQLite cifrada.

Si activa la sincronización en la nube, dichos registros se sincronizan con su cuenta privada en Supabase mediante conexiones seguras cifradas (HTTPS/TLS).

---

## 2. Uso de la información

La información recopilada se utiliza exclusivamente para:
- Proporcionar las funciones principales de gestión de presupuestos, metas de ahorro y registro de gastos e ingresos.
- Autenticar su identidad de forma segura.
- Sincronizar sus datos financieros personales entre sus dispositivos autorizados.

---

## 3. Privacidad y Compartición con Terceros

**No vendemos, alquilamos ni compartimos sus datos personales con anunciantes ni terceros.**

Sus datos sólo se transmiten a:
- **Google Identity Services**: Para gestionar la autenticación de forma segura.
- **Supabase**: Proveedor de infraestructura en la nube para el almacenamiento seguro y sincronización de datos de su cuenta.

---

## 4. Almacenamiento y Seguridad de los Datos

- **Seguridad local**: Los tokens de sesión y credenciales se guardan utilizando el almacenamiento seguro del sistema operativo (Android Keystore / SecureStore).
- **Control biométrico**: La aplicación admite desbloqueo mediante huella dactilar o reconocimiento facial del dispositivo. Los datos biométricos nunca salen de su teléfono ni son accesibles por la aplicación.
- **Control total**: Puede borrar sus datos locales o cerrar sesión en cualquier momento desde los ajustes de la aplicación.

---

## 5. Contacto y Derechos de Eliminación de Datos

Si desea solicitar la eliminación completa de su cuenta y todos sus datos almacenados en la nube, o si tiene alguna pregunta sobre esta política, puede ponerse en contacto a través del repositorio oficial del proyecto:

- **Repositorio oficial:** [https://github.com/Whxismou1/Nummo](https://github.com/Whxismou1/Nummo)
- **Contacto del Desarrollador:** A través de la sección de Issues en GitHub o el correo de soporte configurado en la cuenta del desarrollador.
