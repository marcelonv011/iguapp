// src/pages/legal/TermsConditions.jsx
import React from "react";

export default function TermsConditions() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-8 text-sm md:text-base">
      <h1 className="text-2xl font-bold mb-4">Términos y Condiciones</h1>
      <p className="mb-4 text-muted-foreground">
        Última actualización: 21/11/2025
      </p>

      <p className="mb-4">
        Al usar <strong>ConectCity</strong> aceptás estos Términos y
        Condiciones. Si no estás de acuerdo, no deberías utilizar la
        plataforma.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">1. Naturaleza del servicio</h2>
      <p className="mb-4">
        ConectCity es una plataforma digital que permite a los usuarios publicar
        y visualizar ofertas de empleo, alquileres, ventas, emprendimientos y
        servicios de delivery. ConectCity <strong>no</strong> actúa como
        empleador, inmobiliaria, vendedor, intermediario financiero ni
        repartidor, sino únicamente como un canal de conexión entre usuarios.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">2. Contenido y publicaciones</h2>
      <p className="mb-2">
        Cada usuario es responsable del contenido que publica, incluyendo:
      </p>
      <ul className="list-disc pl-6 mb-4">
        <li>Veracidad de la información</li>
        <li>Legalidad y licitud de los anuncios</li>
        <li>Respeto por derechos de terceros</li>
        <li>No publicar contenido fraudulento, discriminatorio u ofensivo</li>
      </ul>
      <p className="mb-4">
        ConectCity se reserva el derecho de moderar, editar o eliminar
        publicaciones que considere contrarias a estos Términos o a la ley
        vigente, así como suspender o bloquear cuentas en caso de abuso.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">3. Relaciones entre usuarios</h2>
      <p className="mb-4">
        Cualquier acuerdo o contrato que surja del uso de ConectCity (por
        ejemplo, entre empleador y postulante, propietario e inquilino,
        comercio y cliente, comprador y vendedor) es exclusiva responsabilidad
        de las partes involucradas. ConectCity no garantiza resultados ni se
        responsabiliza por conflictos, incumplimientos, daños o perjuicios
        derivados de dichas relaciones.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">4. Servicios de delivery</h2>
      <p className="mb-4">
        En los casos en que comercios utilicen ConectCity para ofrecer servicios
        de delivery, el comercio es el único responsable por la calidad de los
        productos, tiempos de entrega, condiciones de higiene y cualquier otra
        cuestión relacionada con la prestación del servicio. ConectCity no se
        responsabiliza por errores o incumplimientos de los comercios o
        repartidores.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">5. Menores de edad</h2>
      <p className="mb-4">
        La plataforma está dirigida a personas mayores de 18 años. Si sos menor
        de 18 años, solo podés utilizar ConectCity con el consentimiento y
        supervisión de tu madre, padre o tutor legal, quien será responsable
        del uso de la cuenta.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">6. Limitación de responsabilidad</h2>
      <p className="mb-4">
        ConectCity no garantiza la disponibilidad ininterrumpida del servicio,
        ni la exactitud o actualización permanente del contenido publicado por
        los usuarios. En ningún caso ConectCity será responsable por daños
        directos, indirectos, incidentales, especiales o consecuentes derivados
        del uso o imposibilidad de uso de la plataforma.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">7. Modificaciones</h2>
      <p className="mb-4">
        Nos reservamos el derecho de modificar estos Términos y Condiciones en
        cualquier momento. Los cambios serán publicados en la plataforma, y el
        uso continuado del servicio implicará la aceptación de los nuevos
        términos.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">8. Contacto</h2>
      <p className="mb-4">
        Para consultas legales o reclamos podés escribirnos a{" "}
        <a href="mailto:legal@conectcity.com" className="text-primary underline">
          conectcity1@gmail.com
        </a>
        .
      </p>
    </main>
  );
}
