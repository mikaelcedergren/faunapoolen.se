---
layout: default
title: Blogg
slug: blog
permalink: "/blog/"
lang: sv
translation_key: blog
published: true
canonical_url: "/blog/"
alternate_url: "/en/blog/"
---

<div class="background-image">
  <img src="{{ '/assets/media/articles/blog-list-background.jpg' | relative_url }}">
</div>

<header>
  <h1>Blogg</h1>
</header>

{% include article-list.html lang=page.lang %}
{% include cta-soft.html %}
