// src/pages/legal/PrivacyPolicy.jsx
import React from "react";

export default function PrivacyPolicy() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-8 text-sm md:text-base">
      <h1 className="text-2xl font-bold mb-4">Política de Privacidad</h1>
      <p className="mb-4 text-muted-foreground">
        Última actualización: 21/11/2025
      </p>

      <p className="mb-4">
        En <strong>ConectCity</strong> nos comprometemos a proteger la privacidad
        de nuestros usuarios. Esta Política de Privacidad explica qué datos
        recopilamos, cómo los usamos, cómo los almacenamos y cuáles son tus
        derechos de acuerdo con la Ley 25.326 de Protección de Datos Personales
        (Argentina).
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">1. Datos que recopilamos</h2>
      <p className="mb-2">
        Recopilamos los siguientes tipos de información cuando usás ConectCity:
      </p>
      <ul className="list-disc pl-6 mb-4">
        <li>Nombre y apellido</li>
        <li>Correo electrónico</li>
        <li>Teléfono (opcional)</li>
        <li>Ciudad o ubicación</li>
        <li>Imagen de perfil (opcional)</li>
        <li>Datos de publicaciones de empleos, alquileres, ventas, negocios y delivery</li>
        <li>Datos técnicos como navegador y cookies</li>
      </ul>

      <h2 className="text-xl font-semibold mt-6 mb-2">2. Cómo utilizamos tus datos</h2>
      <p className="mb-4">
        Utilizamos tus datos para operar y mejorar ConectCity, administrar tu
        cuenta, mostrar y gestionar tus publicaciones, enviar notificaciones
        relacionadas al servicio, prevenir fraudes y cumplir obligaciones
        legales. <strong>No vendemos tus datos personales a terceros.</strong>
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">3. Con quién compartimos tus datos</h2>
      <p className="mb-4">
        Podemos compartir ciertos datos con proveedores tecnológicos (por
        ejemplo, servicios de hosting, correo, analítica) y con autoridades
        cuando exista una obligación legal o una orden judicial. Siempre
        limitamos el acceso a lo estrictamente necesario.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">4. Derechos del usuario</h2>
      <p className="mb-4">
        Podés ejercer tus derechos de acceso, rectificación, actualización y
        eliminación de tus datos personales enviando un correo a{" "}
        <a href="mailto:conectcity1@gmail.com" className="text-primary underline">
          contacto@conectcity.com
        </a>
        . También podés solicitar la baja de tu cuenta en cualquier momento.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">5. Conservación de datos</h2>
      <p className="mb-4">
        Conservamos tus datos mientras tu cuenta se encuentre activa. Si
        solicitás la eliminación de la cuenta, eliminaremos o anonimizaremos tu
        información en un plazo máximo de 30 días, salvo que debamos conservar
        algo para cumplir una obligación legal.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">6. Menores de edad</h2>
      <p className="mb-4">
        ConectCity está dirigida principalmente a personas mayores de 18 años.
        Si sos menor de 18 años, necesitás el permiso y la supervisión de tu
        madre, padre o tutor legal para utilizar la plataforma. Recomendamos
        que el registro sea realizado por el adulto responsable.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">7. Seguridad</h2>
      <p className="mb-4">
        Utilizamos proveedores que cumplen con estándares de seguridad para
        proteger tus datos. Sin embargo, ningún sistema es 100% seguro, por lo
        que no podemos garantizar seguridad absoluta.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">8. Cambios en esta Política</h2>
      <p className="mb-4">
        Podemos actualizar esta Política de Privacidad para reflejar cambios en
        el servicio o en la normativa. Te notificaremos los cambios relevantes
        a través de la app o el sitio web.
      </p>
    </main>
  );
}
