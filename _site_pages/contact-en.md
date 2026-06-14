---
layout: default
title: Contact us
slug: contact
permalink: "/en/contact/"
lang: en
translation_key: contact
published: true
canonical_url: "/en/contact/"
alternate_url: "/contact/"
description: Get in touch for a free phone consultation about your natural pool or
  water landscape.
seo_title: Contact us | Faunapoolen
---

<div class="background-image">
  <img src="{{ '/assets/media/pages/header-background-4.jpg' | relative_url }}" alt="Contact us">
</div>

<header>
  <h1>Contact us</h1>
  <p>Tell us about your ideas. We offer a free initial phone consultation to discuss your needs and next steps.</p>
</header>
<section>
  <div class="section-content">
    <div class="grid-row">
      <div class="grid-cell">
{% assign business = site.data.settings.business %}
<p class="hidden-responsive">We can help customers across Sweden. Send us an email, call us, or use the contact form. We normally get back within 48 hours.</p>
<table class="mt-2"><tbody><tr><td width="1%" class="text-discreet">Phone</td><td><a href="tel:{{ business.phone_tel | default: business.phone }}">{{ business.phone_display | default: business.phone }}</a></td></tr></tbody></table>
      </div>
      <div class="grid-cell">
{% assign form_endpoint = site.data.settings.forms.formspree_endpoint %}
<form action="{{ form_endpoint }}" method="POST">
<select id="category" name="category" required><option value="" disabled selected>Choose category...</option><option>Natural pool</option><option>Koi pond</option><option>Waterfall</option><option>Rainwater harvesting</option><option>Garden maintenance</option><option>Other</option></select>
<select id="budget" name="budget" required><option value="" disabled selected>Choose your budget...</option><option value="1000000-2000000">1,000,000 - 1,999,000 SEK</option><option value="2000000-4000000">2,000,000 - 3,999,000 SEK</option><option value="4000000-8000000">4,000,000 - 7,999,000 SEK</option><option value="8000000+">8,000,000 SEK or more</option></select>
<input id="location" name="location" type="text" placeholder="Location / postcode..." required>
<input type="text" name="firstName" placeholder="Your name..." required>
<input type="email" name="email" placeholder="Your email..." required>
<input type="text" name="phone" placeholder="Your phone number (optional)...">
<textarea name="message" placeholder="Tell us more about your project..." required></textarea>
<button type="submit">Send</button>
</form>
      </div>
    </div>
  </div>
</section>
