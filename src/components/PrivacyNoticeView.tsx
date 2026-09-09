import React from 'react';
import { 
  ShieldCheck, 
  FileText, 
  ArrowLeft, 
  Building, 
  Phone, 
  Mail, 
  MapPin, 
  Clock, 
  UserCheck, 
  HelpCircle,
  AlertCircle
} from 'lucide-react';
import { useStore } from '../context/StoreContext';

export const CURRENT_PRIVACY_NOTICE_VERSION = '1.0';
export const CURRENT_PRIVACY_NOTICE_DATE = '[FECHA]';

export const PrivacyNoticeView: React.FC = () => {
  const { navigateTo } = useStore();

  return (
    <div className="min-h-screen bg-[#FAFAFA] py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Back Navigation Bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigateTo({ type: 'home' })}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-600 hover:text-orange-600 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a la página principal</span>
          </button>

          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full">
            Documento Informativo y Legal
          </span>
        </div>

        {/* Hero Header */}
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-orange-600">
                Transparencia y Protección de Datos
              </span>
              <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
                Aviso de Privacidad Integral
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-slate-500 border-t border-slate-100">
            <span className="flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Versión: <strong>{CURRENT_PRIVACY_NOTICE_VERSION}</strong></span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Última actualización: <strong>{CURRENT_PRIVACY_NOTICE_DATE}</strong></span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>Proyecto: <strong>Maestro Cerca</strong></span>
            </span>
          </div>
        </div>

        {/* Structured Legal Sections */}
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-xs space-y-10 text-slate-700 leading-relaxed text-sm">

          {/* 1. Responsable del tratamiento de datos personales */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-slate-900">
              <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-black text-xs shrink-0">
                1
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                Responsable del tratamiento de datos personales
              </h2>
            </div>

            <p>
              <strong className="text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded font-mono font-bold">[NOMBRE COMPLETO DEL RESPONSABLE DEL TRATAMIENTO]</strong>, quien actualmente opera el proyecto denominado <strong>Maestro Cerca</strong>, con domicilio para oír y recibir notificaciones en:
            </p>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5 text-xs">
              <div className="flex items-start gap-2">
                <Building className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-900">Responsable: </span>
                  <span className="text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded font-mono font-medium">[NOMBRE COMPLETO DEL RESPONSABLE DEL TRATAMIENTO]</span>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-900">Domicilio para notificaciones: </span>
                  <span className="text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded font-mono font-medium">[DOMICILIO COMPLETO DEL RESPONSABLE]</span>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Mail className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-900">Correo para asuntos de privacidad: </span>
                  <span className="text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded font-mono font-medium">[CORREO PARA SOLICITUDES DE PRIVACIDAD]</span>
                </div>
              </div>
            </div>

            <p>
              es responsable del tratamiento de los datos personales descritos en el presente Aviso de Privacidad.
            </p>
            <p className="text-xs text-slate-600">
              Maestro Cerca se encuentra actualmente en etapa de prototipo o Producto Mínimo Viable (MVP). Esta circunstancia no limita las obligaciones aplicables respecto de la protección y tratamiento adecuado de los datos personales.
            </p>
          </section>

          {/* 2. ¿Qué es Maestro Cerca? */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-slate-900">
              <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-black text-xs shrink-0">
                2
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                ¿Qué es Maestro Cerca?
              </h2>
            </div>
            <p>
              <strong>Maestro Cerca</strong> es el nombre del proyecto bajo el cual se desarrolla una plataforma digital enfocada en conectar personas que necesitan servicios relacionados con construcción, mantenimiento, reparación o remodelación con trabajadores independientes que ofrecen dichos servicios.
            </p>
            <p>
              Los clientes pueden consultar perfiles de trabajadores sin necesidad de crear una cuenta.
            </p>
            <p>
              Los trabajadores pueden registrarse, crear una cuenta y administrar un perfil profesional mediante autenticación por número de teléfono celular o iniciar un registro básico mediante WhatsApp, cuando esta modalidad se encuentre disponible.
            </p>
          </section>

          {/* 3. Datos personales que tratamos */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-slate-900">
              <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-black text-xs shrink-0">
                3
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                Datos personales que tratamos
              </h2>
            </div>
            <p>
              Los datos tratados dependerán del tipo de usuario y de la forma en que utilice Maestro Cerca.
            </p>

            {/* Trabajadores */}
            <div className="p-4 sm:p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-orange-600" />
                <span>Trabajadores</span>
              </h3>
              <p className="text-xs text-slate-600">
                Maestro Cerca puede recabar y tratar:
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-700 list-disc list-inside">
                <li>Nombre y apellidos.</li>
                <li>Número de teléfono celular.</li>
                <li>Número utilizado en WhatsApp.</li>
                <li>Correo electrónico, cuando sea proporcionado voluntariamente.</li>
                <li>Ciudad o municipio donde presta servicios.</li>
                <li>Zonas de cobertura.</li>
                <li>Oficio o especialidad.</li>
                <li>Servicios y trabajos que realiza.</li>
                <li>Años de experiencia.</li>
                <li>Disponibilidad.</li>
                <li>Descripción profesional.</li>
                <li>Fotografía de perfil.</li>
                <li>Fotografías de trabajos realizados.</li>
                <li>Información relacionada con referencias profesionales, cuando sean solicitadas.</li>
                <li>Información relacionada con procesos de verificación del perfil.</li>
                <li>Estado o distintivo de verificación dentro de Maestro Cerca.</li>
                <li>Fecha de registro.</li>
                <li>Identificadores técnicos asociados con la cuenta.</li>
                <li className="sm:col-span-2">Información necesaria para seguridad, prevención de abuso y funcionamiento de la plataforma.</li>
              </ul>
            </div>

            {/* Clientes y visitantes */}
            <div className="p-4 sm:p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-slate-600" />
                <span>Clientes y visitantes</span>
              </h3>
              <p className="text-xs text-slate-600">
                Actualmente, los clientes no necesitan crear una cuenta para consultar Maestro Cerca.
              </p>
              <p className="text-xs text-slate-600">
                Dependiendo de las herramientas efectivamente habilitadas en el sitio, Maestro Cerca podrá registrar información de navegación e interacción necesaria para operar, proteger y evaluar el funcionamiento del MVP, incluyendo, cuando corresponda:
              </p>
              <ul className="list-disc list-inside text-xs text-slate-700 space-y-1 pl-1">
                <li>Búsquedas realizadas.</li>
                <li>Oficio o servicio buscado.</li>
                <li>Zona consultada.</li>
                <li>Perfiles consultados.</li>
                <li>Clics realizados para contactar a un trabajador mediante WhatsApp.</li>
                <li>Clics realizados para iniciar llamadas.</li>
                <li>Información técnica básica asociada con seguridad, funcionamiento y uso del servicio.</li>
              </ul>
              <p className="text-xs text-slate-600 pt-1">
                Maestro Cerca procurará limitar la recopilación de información a aquella que resulte necesaria, adecuada y relevante para las finalidades descritas en este Aviso.
              </p>
            </div>
          </section>

          {/* 4. Datos personales sensibles */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-slate-900">
              <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-black text-xs shrink-0">
                4
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                Datos personales sensibles
              </h2>
            </div>
            <p>
              Maestro Cerca <strong>no busca recopilar deliberadamente datos personales sensibles</strong> durante el proceso ordinario de registro.
            </p>
            <p className="text-xs text-slate-600">
              Por favor, no proporciones innecesariamente información relacionada con tu salud, origen racial o étnico, creencias religiosas o filosóficas, opiniones políticas, información genética, preferencia sexual u otra información sensible que no sea necesaria para utilizar Maestro Cerca.
            </p>
            <p className="text-xs text-slate-600">
              Una fotografía ordinaria utilizada como imagen de perfil no será utilizada por Maestro Cerca con el propósito de realizar identificación biométrica, reconocimiento facial o autenticación biométrica, salvo que en el futuro se implemente expresamente una función de esa naturaleza y el Aviso de Privacidad sea actualizado previamente.
            </p>
            <p className="text-xs text-slate-600">
              Si Maestro Cerca incorpora posteriormente verificaciones mediante identificaciones oficiales, biometría u otras categorías adicionales de información, se actualizará este Aviso antes de iniciar dicho tratamiento y se implementarán las medidas de consentimiento que legalmente correspondan.
            </p>
          </section>

          {/* 5. Finalidades principales del tratamiento */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-slate-900">
              <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-black text-xs shrink-0">
                5
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                Finalidades principales del tratamiento
              </h2>
            </div>
            <p>
              Los datos personales de los trabajadores podrán utilizarse para:
            </p>
            <ul className="list-disc list-inside text-xs text-slate-700 space-y-1.5 pl-1">
              <li>Crear y administrar su cuenta.</li>
              <li>Autenticar su acceso a Maestro Cerca.</li>
              <li>Crear, administrar y mostrar su perfil profesional.</li>
              <li>Permitir que potenciales clientes conozcan sus servicios.</li>
              <li>Mostrar su oficio, servicios, experiencia y zonas de cobertura.</li>
              <li>Facilitar el contacto entre clientes y trabajadores.</li>
              <li>Administrar fotografías y portafolios de trabajos.</li>
              <li>Gestionar solicitudes y estados de verificación.</li>
              <li>Comunicarse con el trabajador respecto de su cuenta y perfil.</li>
              <li>Atender solicitudes de soporte.</li>
              <li>Prevenir fraude, abuso, suplantación o usos indebidos.</li>
              <li>Mantener la seguridad y correcto funcionamiento de la plataforma.</li>
              <li>Operar técnicamente Maestro Cerca.</li>
              <li>Detectar errores y mejorar el servicio.</li>
              <li>Analizar el funcionamiento del MVP.</li>
            </ul>
            <p className="text-xs text-slate-700 pt-1">
              La creación de un perfil destinado a ser consultado por clientes implica que <strong>determinados datos profesionales del trabajador serán visibles para terceros</strong>, conforme se explica a continuación.
            </p>
          </section>

          {/* 6. Información visible para los clientes */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-slate-900">
              <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-black text-xs shrink-0">
                6
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                Información visible para los clientes
              </h2>
            </div>
            <p>
              El propósito de Maestro Cerca requiere mostrar determinada información profesional para que los clientes puedan conocer y evaluar los servicios ofrecidos por cada trabajador.
            </p>
            <p className="text-xs text-slate-600">
              Dependiendo de la información proporcionada y autorizada por el trabajador, su perfil podrá mostrar:
            </p>
            <ul className="list-disc list-inside text-xs text-slate-700 space-y-1 pl-1">
              <li>Nombre.</li>
              <li>Oficio o especialidad.</li>
              <li>Servicios que realiza.</li>
              <li>Años de experiencia.</li>
              <li>Ciudad, municipio o zonas de cobertura.</li>
              <li>Disponibilidad cuando corresponda.</li>
              <li>Descripción profesional.</li>
              <li>Fotografía de perfil autorizada.</li>
              <li>Fotografías de trabajos autorizadas.</li>
              <li>Estado o distintivo de verificación.</li>
              <li>Medio de contacto autorizado para recibir clientes.</li>
            </ul>
            <p className="text-xs text-slate-700">
              Los datos utilizados exclusivamente para autenticación, administración interna, seguridad o funcionamiento técnico <strong>no serán publicados automáticamente</strong>.
            </p>
            <p className="text-xs text-slate-600">
              En particular, que un número telefónico sea utilizado para iniciar sesión en Maestro Cerca no significa por sí mismo que dicho número deba mostrarse públicamente.
            </p>
            <p className="text-xs text-slate-600">
              Cuando el trabajador autorice un teléfono o número de WhatsApp como medio de contacto profesional, éste podrá mostrarse o utilizarse para permitir que potenciales clientes se comuniquen con él conforme al funcionamiento de la plataforma.
            </p>
          </section>

          {/* 7. Autenticación mediante teléfono celular */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-slate-900">
              <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-black text-xs shrink-0">
                7
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                Autenticación mediante teléfono celular
              </h2>
            </div>
            <p>
              Maestro Cerca utiliza el número de teléfono celular de los trabajadores como uno de los principales mecanismos de creación e identificación de cuentas.
            </p>
            <p className="text-xs text-slate-600">
              El número puede utilizarse para:
            </p>
            <ul className="list-disc list-inside text-xs text-slate-700 space-y-1 pl-1">
              <li>Crear la cuenta.</li>
              <li>Identificar al trabajador.</li>
              <li>Enviar códigos de autenticación mediante SMS.</li>
              <li>Permitir el inicio de sesión.</li>
              <li>Proteger el acceso a la cuenta.</li>
              <li>Prevenir registros o accesos indebidos.</li>
            </ul>
            <p className="text-xs text-slate-700">
              Actualmente Maestro Cerca utiliza <strong>Firebase Authentication</strong>, tecnología proporcionada por Google, para administrar la autenticación mediante número telefónico.
            </p>
            <p className="text-xs text-slate-600">
              El envío y procesamiento técnico de códigos de autenticación puede requerir la participación de infraestructura y proveedores tecnológicos necesarios para proporcionar este servicio.
            </p>
          </section>

          {/* 8. Registro mediante WhatsApp y ManyChat */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-slate-900">
              <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-black text-xs shrink-0">
                8
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                Registro mediante WhatsApp y ManyChat
              </h2>
            </div>
            <p>
              Algunos trabajadores pueden iniciar un registro básico mediante conversaciones realizadas por WhatsApp y automatizadas total o parcialmente utilizando ManyChat.
            </p>
            <p className="text-xs text-slate-600">
              Durante este proceso podrán solicitarse datos para:
            </p>
            <ul className="list-disc list-inside text-xs text-slate-700 space-y-1 pl-1">
              <li>Crear un registro inicial.</li>
              <li>Identificar al trabajador.</li>
              <li>Registrar su oficio y servicios.</li>
              <li>Conocer su ciudad o zona de cobertura.</li>
              <li>Registrar experiencia y disponibilidad.</li>
              <li>Recibir fotografías de trabajos.</li>
              <li>Registrar un medio de contacto.</li>
              <li>Crear un perfil básico.</li>
              <li>Posteriormente relacionar esa información con una cuenta de Maestro Cerca.</li>
            </ul>
            <p className="text-xs text-slate-700">
              Antes de iniciar la recopilación de información personal mediante este flujo, Maestro Cerca mostrará un aviso de privacidad y solicitará una acción afirmativa de aceptación.
            </p>
            <p className="text-xs text-slate-600">
              El registro no deberá continuar cuando el usuario seleccione expresamente que no acepta el tratamiento informado.
            </p>
          </section>

          {/* 9. Fotografías */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-slate-900">
              <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-black text-xs shrink-0">
                9
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                Fotografías
              </h2>
            </div>
            <p>
              Los trabajadores pueden proporcionar fotografías para ilustrar su perfil profesional y mostrar trabajos que hayan realizado.
            </p>
            <p className="text-xs text-slate-600">
              Las fotografías podrán almacenarse mediante servicios como Firebase Storage y la infraestructura tecnológica utilizada por Maestro Cerca.
            </p>
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 font-medium">
              El trabajador deberá procurar compartir únicamente fotografías sobre las cuales tenga derecho o autorización para su publicación y evitar imágenes que muestren documentos, domicilios, teléfonos u otros datos personales de terceros sin autorización.
            </div>
            <p className="text-xs text-slate-600">
              Asimismo, se recomienda evitar fotografías que permitan identificar innecesariamente a clientes, menores de edad, placas vehiculares, documentos, comprobantes, direcciones o información privada.
            </p>
            <p className="text-xs text-slate-600">
              La autorización para utilizar fotografías dentro del perfil de Maestro Cerca no implica automáticamente autorización para utilizarlas en campañas publicitarias, publicaciones promocionales o redes sociales ajenas al funcionamiento ordinario del perfil. Dichos usos deberán contar, cuando corresponda, con autorización adicional.
            </p>
          </section>

          {/* 10. Proveedores tecnológicos */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-slate-900">
              <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-black text-xs shrink-0">
                10
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                Proveedores tecnológicos
              </h2>
            </div>
            <p>
              Para operar Maestro Cerca se utilizan o pueden utilizarse distintos proveedores tecnológicos.
            </p>
            <p className="text-xs text-slate-600">
              Actualmente se contempla la participación de servicios como:
            </p>
            <ul className="list-disc list-inside text-xs text-slate-700 space-y-1 pl-1">
              <li>Google Firebase.</li>
              <li>Firebase Authentication.</li>
              <li>Cloud Firestore.</li>
              <li>Firebase Storage.</li>
              <li>Google Cloud.</li>
              <li>ManyChat.</li>
              <li>WhatsApp y servicios de Meta cuando la persona interactúa mediante WhatsApp.</li>
              <li>Herramientas de Google utilizadas durante el desarrollo de Maestro Cerca.</li>
            </ul>
            <p className="text-xs text-slate-600">
              Estos proveedores pueden intervenir en el tratamiento de información en la medida necesaria para proporcionar la infraestructura, almacenamiento, autenticación, mensajería, automatización, seguridad u otros servicios tecnológicos utilizados por Maestro Cerca.
            </p>
            <p className="text-xs text-slate-600">
              La participación de un proveedor tecnológico no implica necesariamente que todos los proveedores tengan la misma calidad jurídica ni que toda operación constituya una transferencia de datos personales. Maestro Cerca deberá determinar la función de cada proveedor conforme al servicio contratado, las condiciones aplicables y la legislación correspondiente.
            </p>
            <p className="text-xs text-slate-600">
              Cuando un proveedor trate información por cuenta del responsable, su participación deberá limitarse a las instrucciones y finalidades correspondientes al servicio utilizado.
            </p>
            <p className="text-xs text-slate-600">
              Las propias plataformas y servicios de terceros también pueden realizar determinados tratamientos conforme a sus respectivos términos y avisos de privacidad.
            </p>
          </section>

          {/* 11. Transferencias y comunicación de información */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-slate-900">
              <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-black text-xs shrink-0">
                11
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                Transferencias y comunicación de información
              </h2>
            </div>
            <p>
              Maestro Cerca podrá comunicar información cuando ello sea necesario para prestar el servicio solicitado por el trabajador, incluyendo hacer visible la información profesional autorizada dentro de su perfil para que potenciales clientes puedan conocer sus servicios y contactarlo.
            </p>
            <p className="text-xs text-slate-600">
              Cuando Maestro Cerca realice transferencias de datos personales a terceros distintos de las personas encargadas del tratamiento, éstas se efectuarán conforme al presente Aviso, al consentimiento otorgado y a los supuestos permitidos por la legislación aplicable.
            </p>
            <p className="text-xs text-slate-600">
              Cuando legalmente se requiera consentimiento para una transferencia, Maestro Cerca deberá contar con dicho consentimiento.
            </p>
            <p className="text-xs text-slate-600">
              No se considerará automáticamente como transferencia la entrega de datos a una persona encargada que los trate por cuenta del responsable, de conformidad con la legislación aplicable.
            </p>
            <p className="text-xs text-slate-600">
              Maestro Cerca también podrá comunicar información cuando resulte necesario para cumplir una obligación legal, atender una orden emitida por autoridad competente, ejercer o defender derechos, prevenir fraude o atender otros supuestos permitidos por la legislación mexicana.
            </p>
          </section>

          {/* 12. Consentimiento */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-slate-900">
              <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-black text-xs shrink-0">
                12
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                Consentimiento
              </h2>
            </div>
            <p>
              En los procesos de registro en Maestro Cerca podrá solicitarse al trabajador que manifieste expresamente:
            </p>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 text-center sm:text-left">
              “He leído y acepto el Aviso de Privacidad.”
            </div>
            <p className="text-xs text-slate-600">
              La aceptación no deberá encontrarse preseleccionada y el registro no podrá continuar cuando el flujo haya sido diseñado para requerir dicha aceptación y ésta no se haya otorgado.
            </p>
            <p className="text-xs text-slate-600">
              Maestro Cerca podrá conservar evidencia técnica de la aceptación, incluyendo:
            </p>
            <ul className="list-disc list-inside text-xs text-slate-700 space-y-1 pl-1">
              <li>Estado de aceptación.</li>
              <li>Fecha y hora.</li>
              <li>Número o identificador de cuenta relacionado.</li>
              <li>Versión del Aviso aceptada.</li>
            </ul>
            <p className="text-xs text-slate-600">
              En el sistema podrán utilizarse, entre otros, los siguientes campos:
            </p>
            <div className="flex flex-wrap gap-2 text-xs font-mono">
              <span className="bg-slate-100 px-2 py-1 rounded text-slate-800 border border-slate-200">privacyNoticeAccepted</span>
              <span className="bg-slate-100 px-2 py-1 rounded text-slate-800 border border-slate-200">privacyNoticeAcceptedAt</span>
              <span className="bg-slate-100 px-2 py-1 rounded text-slate-800 border border-slate-200">privacyNoticeVersion</span>
            </div>
            <p className="text-xs text-slate-600 pt-1">
              En los registros realizados mediante WhatsApp o ManyChat se utilizará una acción equivalente, por ejemplo mediante el botón o respuesta <strong>“Acepto”</strong>, antes de iniciar la recopilación prevista en ese flujo.
            </p>
          </section>

          {/* 13. Limitación del uso o divulgación */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-slate-900">
              <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-black text-xs shrink-0">
                13
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                Limitación del uso o divulgación
              </h2>
            </div>
            <p>
              La persona titular podrá solicitar que se limite el uso o divulgación de determinados datos personales cuando corresponda legalmente.
            </p>
            <p className="text-xs text-slate-700">
              Estas solicitudes podrán enviarse a:
            </p>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <span className="text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded font-mono font-medium">[CORREO PARA SOLICITUDES DE PRIVACIDAD]</span>
            </div>
            <p className="text-xs text-slate-600">
              La solicitud deberá identificar suficientemente a la persona titular y describir el uso o divulgación que desea limitar.
            </p>
            <p className="text-xs text-slate-600">
              Determinadas limitaciones podrían impedir que alguna función de Maestro Cerca continúe operando. Por ejemplo, solicitar que ninguna información profesional sea visible para clientes puede resultar incompatible con mantener activo un perfil público de trabajador.
            </p>
          </section>

          {/* 14. Tus derechos sobre tus datos — Derechos ARCO */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-slate-900">
              <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-black text-xs shrink-0">
                14
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                Tus derechos sobre tus datos — Derechos ARCO
              </h2>
            </div>
            <p>
              La legislación mexicana reconoce los derechos de <strong>Acceso, Rectificación, Cancelación y Oposición (ARCO)</strong>.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Acceso</h3>
                <p className="text-xs text-slate-600">
                  Puedes solicitar conocer qué datos personales conserva Maestro Cerca y las condiciones generales de su tratamiento.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Rectificación</h3>
                <p className="text-xs text-slate-600">
                  Puedes solicitar que información incorrecta, incompleta o desactualizada sea corregida.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Cancelación</h3>
                <p className="text-xs text-slate-600">
                  Puedes solicitar la cancelación de tus datos cuando resulte procedente. La cancelación podrá implicar inicialmente un periodo de bloqueo cuando sea necesario conservar cierta información únicamente para atender posibles responsabilidades, obligaciones legales o controversias, y posteriormente proceder a su supresión cuando corresponda.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Oposición</h3>
                <p className="text-xs text-slate-600">
                  Puedes solicitar oponerte a determinados tratamientos cuando legalmente resulte procedente.
                </p>
              </div>
            </div>

            {/* ¿Cómo ejercer estos derechos? */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs">
              <h3 className="font-bold text-slate-900 text-xs sm:text-sm">
                ¿Cómo ejercer estos derechos?
              </h3>
              <p>
                Envía tu solicitud a: <span className="text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded font-mono font-medium">[CORREO PARA SOLICITUDES DE PRIVACIDAD]</span>
              </p>
              <p className="font-bold text-slate-900 pt-1">La solicitud deberá contener, según corresponda:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1">
                <li>Tu nombre.</li>
                <li>Un medio para recibir la respuesta.</li>
                <li>Información suficiente para acreditar razonablemente tu identidad.</li>
                <li>Una descripción clara de los datos involucrados.</li>
                <li>El derecho que deseas ejercer.</li>
                <li>Cualquier información que facilite localizar tus datos.</li>
              </ul>
              <p className="text-slate-600 pt-1">
                Maestro Cerca podrá solicitar únicamente la información necesaria para verificar que la solicitud proviene de la persona titular o de su representante legítimo.
              </p>
              <p className="text-slate-700 font-medium pt-1">
                Conforme a los plazos establecidos por la legislación aplicable, se comunicará la determinación correspondiente dentro de un plazo máximo de <strong>20 días hábiles</strong> desde la recepción de una solicitud completa y, cuando resulte procedente, se hará efectiva dentro de los <strong>15 días hábiles siguientes</strong>. Dichos plazos podrán ampliarse en los supuestos permitidos legalmente.
              </p>
            </div>
          </section>

          {/* 15. Revocación del consentimiento */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-slate-900">
              <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-black text-xs shrink-0">
                15
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                Revocación del consentimiento
              </h2>
            </div>
            <p>
              La persona titular podrá solicitar la revocación de su consentimiento respecto de tratamientos que dependan de éste cuando legalmente corresponda.
            </p>
            <p className="text-xs text-slate-700">
              Las solicitudes deberán enviarse a:
            </p>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <span className="text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded font-mono font-medium">[CORREO PARA SOLICITUDES DE PRIVACIDAD]</span>
            </div>
            <p className="text-xs text-slate-600">
              La revocación no tendrá efectos retroactivos.
            </p>
            <p className="text-xs text-slate-600">
              La revocación o eliminación de una cuenta puede no implicar la eliminación inmediata de absolutamente toda la información si resulta necesario conservar determinados datos temporalmente para cumplir obligaciones legales, resolver controversias, atender responsabilidades o proteger la seguridad de la plataforma.
            </p>
          </section>

          {/* 16. Eliminación de cuenta y perfil */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-slate-900">
              <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-black text-xs shrink-0">
                16
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                Eliminación de cuenta y perfil
              </h2>
            </div>
            <p>
              Los trabajadores podrán solicitar la cancelación o eliminación de su cuenta y perfil.
            </p>
            <p className="text-xs text-slate-600">
              Cuando la solicitud sea procedente, Maestro Cerca dejará de mostrar públicamente el perfil y procederá al bloqueo, eliminación, anonimización o conservación limitada de la información conforme a la legislación aplicable y a las razones legítimas que justifiquen temporalmente su conservación.
            </p>
            <p className="text-xs text-slate-600">
              Las copias de seguridad podrán requerir procesos técnicos de eliminación posteriores, sin que la información bloqueada pueda continuar utilizándose ordinariamente para las finalidades de la cuenta cancelada.
            </p>
          </section>

          {/* 17. Seguridad de la información */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-slate-900">
              <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-black text-xs shrink-0">
                17
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                Seguridad de la información
              </h2>
            </div>
            <p>
              Maestro Cerca implementará medidas administrativas, técnicas y organizativas razonables y proporcionales para proteger los datos personales contra daño, pérdida, alteración, destrucción, acceso o tratamiento no autorizado.
            </p>
            <p className="text-xs text-slate-600">
              Dependiendo de la infraestructura técnica disponible, estas medidas pueden incluir:
            </p>
            <ul className="list-disc list-inside text-xs text-slate-700 space-y-1 pl-1">
              <li>Autenticación mediante teléfono celular.</li>
              <li>Firebase Authentication.</li>
              <li>Reglas de acceso a Cloud Firestore.</li>
              <li>Restricciones de acceso a Firebase Storage.</li>
              <li>Separación de permisos.</li>
              <li>Control de acceso a herramientas administrativas.</li>
              <li>Medidas orientadas a prevenir acceso no autorizado.</li>
            </ul>
            <p className="text-xs text-slate-600">
              Ningún sistema conectado a internet puede considerarse completamente libre de riesgos, por lo que Maestro Cerca no garantiza una seguridad absoluta o imposibilidad total de incidentes.
            </p>
            <p className="text-xs text-slate-600">
              Cuando ocurra una vulneración de seguridad que legalmente deba ser informada a las personas titulares, Maestro Cerca realizará las comunicaciones correspondientes conforme a la legislación aplicable.
            </p>
          </section>

          {/* 18. Conservación de información */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-slate-900">
              <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-black text-xs shrink-0">
                18
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                Conservación de información
              </h2>
            </div>
            <p>
              Los datos personales serán conservados durante el tiempo razonablemente necesario para:
            </p>
            <ul className="list-disc list-inside text-xs text-slate-700 space-y-1 pl-1">
              <li>Mantener una cuenta activa.</li>
              <li>Operar un perfil.</li>
              <li>Cumplir las finalidades descritas en este Aviso.</li>
              <li>Atender solicitudes de los usuarios.</li>
              <li>Cumplir obligaciones legales.</li>
              <li>Resolver controversias.</li>
              <li>Determinar posibles responsabilidades.</li>
              <li>Prevenir fraude, abuso o usos indebidos.</li>
            </ul>
            <p className="text-xs text-slate-600">
              Cuando los datos hayan dejado de resultar necesarios, se procederá a su bloqueo, eliminación o anonimización conforme corresponda y de acuerdo con la legislación aplicable.
            </p>
          </section>

          {/* 19. Menores de edad */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-slate-900">
              <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-black text-xs shrink-0">
                19
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                Menores de edad
              </h2>
            </div>
            <p className="font-bold text-slate-900">
              Maestro Cerca no está dirigido al registro de trabajadores menores de 18 años.
            </p>
            <p className="text-xs text-slate-600">
              Las personas que deseen crear un perfil como trabajadores deberán ser mayores de edad.
            </p>
            <p className="text-xs text-slate-600">
              Si Maestro Cerca detecta que se registró información correspondiente a un menor de edad sin contar con una base jurídica y autorización adecuadas, podrá cancelar el registro y adoptar las medidas necesarias para evitar el tratamiento no autorizado de dicha información.
            </p>
          </section>

          {/* 20. Información recopilada mediante tecnologías del sitio */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-slate-900">
              <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-black text-xs shrink-0">
                20
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                Información recopilada mediante tecnologías del sitio
              </h2>
            </div>
            <p>
              Cuando se encuentren habilitadas herramientas de analítica, seguridad o medición, Maestro Cerca podrá utilizar tecnologías que permitan registrar información relacionada con la interacción con la plataforma.
            </p>
            <p className="text-xs text-slate-600">
              Esto puede incluir información acerca de búsquedas, perfiles visitados y acciones realizadas dentro del sitio únicamente cuando dichas funciones se encuentren técnicamente implementadas.
            </p>
            <p className="text-xs text-slate-600">
              Cuando la utilización de cookies, identificadores u otras tecnologías requiera información adicional o mecanismos de consentimiento específicos, Maestro Cerca deberá implementarlos y actualizar este Aviso según corresponda.
            </p>
          </section>

          {/* 21. Cambios al Aviso de Privacidad */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-slate-900">
              <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-black text-xs shrink-0">
                21
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                Cambios al Aviso de Privacidad
              </h2>
            </div>
            <p>
              Maestro Cerca podrá modificar el presente Aviso de Privacidad para reflejar cambios legales, operativos o tecnológicos.
            </p>
            <p className="text-xs text-slate-600">
              Las modificaciones estarán disponibles en:
            </p>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-orange-600">
              /aviso-de-privacidad
            </div>
            <p className="text-xs text-slate-600">
              Cuando las modificaciones resulten relevantes para el tratamiento de datos ya registrado, podrán comunicarse adicionalmente mediante los medios de contacto disponibles cuando resulte apropiado.
            </p>
            <p className="text-xs text-slate-600">
              Cuando una modificación implique nuevas finalidades que requieran consentimiento adicional, éste deberá recabarse cuando legalmente corresponda.
            </p>
            <div className="pt-2 text-xs text-slate-500 flex flex-wrap items-center gap-3">
              <span><strong>Última actualización:</strong> {CURRENT_PRIVACY_NOTICE_DATE}</span>
              <span>•</span>
              <span><strong>Versión:</strong> {CURRENT_PRIVACY_NOTICE_VERSION}</span>
            </div>
          </section>

          {/* 22. Contacto en materia de privacidad */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-slate-900">
              <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-black text-xs shrink-0">
                22
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                Contacto en materia de privacidad
              </h2>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 text-xs">
              <div className="flex items-start gap-2">
                <Building className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-900">Responsable: </span>
                  <span className="text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded font-mono font-medium">[NOMBRE COMPLETO DEL RESPONSABLE DEL TRATAMIENTO]</span>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Mail className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-900">Correo para solicitudes de privacidad: </span>
                  <span className="text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded font-mono font-medium">[CORREO PARA SOLICITUDES DE PRIVACIDAD]</span>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-900">Domicilio para notificaciones: </span>
                  <span className="text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded font-mono font-medium">[DOMICILIO COMPLETO DEL RESPONSABLE]</span>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Phone className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-900">Teléfono general de Maestro Cerca: </span>
                  <span className="font-mono font-bold text-slate-800">+52 442 439 9676</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 pt-1 leading-relaxed">
                El teléfono anterior es un medio general de contacto del proyecto y no sustituye el correo o procedimiento que se establezca formalmente para ejercer derechos en materia de protección de datos personales.
              </p>
            </div>
          </section>

          {/* Nota final del documento */}
          <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-start gap-3 text-xs text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Nota:</strong> El presente documento corresponde a una propuesta de Aviso de Privacidad para el MVP de Maestro Cerca y deberá ser revisado antes de su publicación definitiva por un profesional jurídico competente, especialmente una vez determinada la identidad formal del responsable del tratamiento.
            </p>
          </div>

        </div>

        {/* Bottom Helper Bar */}
        <div className="p-4 sm:p-6 bg-slate-100 border border-slate-200 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-orange-600 shrink-0" />
            <span>¿Tienes dudas sobre el Aviso de Privacidad o el tratamiento de tus datos?</span>
          </div>
          <button
            onClick={() => navigateTo({ type: 'home' })}
            className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-900 border border-slate-300 font-bold rounded-xl transition-colors cursor-pointer"
          >
            Regresar al inicio
          </button>
        </div>

      </div>
    </div>
  );
};
