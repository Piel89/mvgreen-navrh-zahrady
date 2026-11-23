# Scénář testu platby a zprovoznění Stripe (23. 11. 2026)

Nic z toho jsem neprovedl. Klíče a hesla zadává vždy Martin.

## 1. Příprava (Martin)
1. Účet Stripe pro podnikatele (IČO 21119121). Začít v **testovacím režimu** (klíče začínají `sk_test_`).
2. V administraci pluginu vložit testovací klíč (secret) a webhook secret.
3. Ve Stripe přidat webhook na adresu `https://mvgreen.cz/wp-admin/admin-post.php?action=mvgreen_stripe_webhook` a zapnout události `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`.
4. Ověřit, že odesílání e-mailů funguje (viz bod 4).
5. Tento test provést na soukromých testovacích stránkách `/plan-uvod-test/` a `/plan-dotaznik-test/`.

## 2. Testovací karty Stripe
- Úspěšná platba: `4242 4242 4242 4242`, libovolné budoucí datum, libovolné CVC.
- Platba vyžadující ověření 3-D Secure: `4000 0027 6000 3184`.
- Odmítnutá karta: `4000 0000 0000 0002`.
(Zveřejněné testovací karty Stripe. Čísla je vhodné ověřit v jejich dokumentaci před testem.)

## 3. Scénáře a očekávaný výsledek
| # | Postup | Očekávání | Výsledek |
|---|---|---|---|
| 1 | Vyplnit dotazník, zaškrtnout souhlas, zaplatit úspěšnou kartou | návrat na stránku, plán se sám odemkne, adresa obsahuje `#kod=` | ☐ |
| 2 | Totéž | do několika minut dorazí e-mail s kódem a odkazem (Gmail i Seznam), jen jeden | ☐ |
| 3 | Odkaz z e-mailu otevřít v jiném zařízení | plán se odemkne a vyplní odpovědi z dotazníku | ☐ |
| 4 | Zaplatit a hned zavřít okno před návratem | webhook objednávku aktivuje, e-mail dorazí | ☐ |
| 5 | Platba s 3-D Secure | projde, stejný výsledek jako 1 | ☐ |
| 6 | Odmítnutá karta | plán zůstane zamčený, srozumitelná chyba | ☐ |
| 7 | Zrušit platbu v bráně (zpět) | plán zamčený, objednávka nezaplacená | ☐ |
| 8 | Zadat kód ručně do pole „Už máte kód“ | odemkne se | ☐ |
| 9 | Zadat 21× špatný kód z jedné adresy | po 20 pokusech za hodinu zablokuje | ☐ |
| 10 | Odeslat objednávku bez souhlasu | odmítnuto | ☐ |

## 4. E-mail
- Zkontrolovat SPF, DKIM a DMARC u domény mvgreen.cz (DNS) a nastavení Easy WP SMTP.
- Zkušební e-mail: Gmail, Seznam, případně Outlook. Ověřit, že nejde do spamu.

## 5. Ostrý provoz (až po úspěšných scénářích)
1. Přepnout na ostré klíče (zadává Martin).
2. Jedna skutečná platba 499 Kč vlastní kartou, ověřit e-mail a odemknutí.
3. Platbu vrátit ve Stripe.
4. Smazat testovací objednávky v administraci (záznamy `mvgreen_kod`).
5. Odemknout veřejné stránky až po souhlasu Martina.

## 6. Doklady a daně
Za digitální obsah je třeba vést tržby a doklady. Jak (Stripe potvrzení, vlastní doklad, evidence), musí potvrdit účetní. Podle obchodních podmínek není Martin plátcem DPH.
