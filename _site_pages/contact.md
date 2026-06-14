---
layout: default
title: Kontakta oss
slug: contact
permalink: "/contact/"
lang: sv
translation_key: contact
published: true
canonical_url: "/contact/"
alternate_url: "/en/contact/"
---

<div class="background-image">
  <img src="{{ '/assets/media/pages/header-background-4.jpg' | relative_url }}">
</div>

<header>

  <h1>Kontakta oss</h1>
  <p>Hör av dig till oss! Vi erbjuder en kostnadsfri telefonkonsultation där vi kan diskutera dina idéer och behov.</p>
</header>

<section>
  <div class="section-content">
    <div class="grid-row">
      <div class="grid-cell">
        {% assign business = site.data.settings.business %}
        <p class="hidden-responsive">Vi kan hjälpa dig över hela landet. Tveka inte att skicka ett e-postmeddelande, ring oss, eller använd vårt kontaktformulär. Vi återkommer inom 48 timmar.</p>
        <table class="mt-2">
          <tbody>
            <tr>
              <td width="1%" class="text-discreet">Telefon</td>
              <td><a href="tel:{{ business.phone_tel | default: business.phone }}">{{ business.phone_display | default: business.phone }}</a></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="grid-cell">
        {% assign form_endpoint = site.data.settings.forms.formspree_endpoint %}
        <form action="{{ form_endpoint }}" method="POST">
          <select id="category" name="kategori" required>
            <option value="" disabled selected>Välj kategori...</option>
            <option>Naturpool</option>
            <option>Koi-damm</option>
            <option>Vattenfall</option>
            <option>Regnvattenskörd</option>
            <option>Trädgårdsskötsel</option>
            <option>Annat</option>
          </select>
          <select id="budget" name="budget" required>
            <option value="" disabled selected>Välj din budget...</option>
            <option value="1000000-2000000">1 000 000 – 1 999 000 kr</option>
            <option value="2000000-4000000">2 000 000 – 3 999 000 kr</option>
            <option value="4000000-8000000">4 000 000 – 7 999 000 kr</option>
            <option value="8000000+">8 000 000 kr eller mer</option>
          </select>
          <input id="location" name="plats" type="text" placeholder="Plats / postnummer..." required>
          <input type="text" name="firstName" placeholder="Ditt namn..." required="required" />
          <input type="email" name="email" placeholder="Din epost..." required="required" />
          <input type="text" name="phone" placeholder="Ditt telefonnummer (valfritt)..." />
          <textarea name="message" placeholder="Berätta mer om ditt projekt..." required="required"></textarea>
          <!-- your other form fields go here -->
          <button type="submit">Skicka</button>
        </form>
      </div>
    </div>
  </div>
</section>
