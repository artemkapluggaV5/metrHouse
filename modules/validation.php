<?php
declare(strict_types=1);

// Patterns are shared with the forms so a paste and an API request follow the same rules.
const NAME_WORD = '\p{L}[\p{L}\p{M}]*(?:[-‐‑’\x27]\p{L}[\p{L}\p{M}]*)*';
const EMAIL_ATOM = '[A-Za-z0-9!#$%&\x27*+/=?^_`{|}~-]+';
const DOMAIN_LABEL = '[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?';
const CONTACT_RULES = [
    'full_name' => [
        'pattern' => NAME_WORD.'(?: +'.NAME_WORD.')+',
        'message' => 'Укажите имя и фамилию через пробел. Допустимы буквы, дефис и апостроф.',
    ],
    'email' => [
        'pattern' => '(?=[^@]{1,64}@)'.EMAIL_ATOM.'(?:\.'.EMAIL_ATOM.')*@(?:'.DOMAIN_LABEL.'\.)+[A-Za-z](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?',
        'message' => 'Введите адрес с именем и доменом, например anna.petrova+dom@example.ru.',
    ],
    'phone' => [
        'pattern' => '(?=(?:[^0-9]*[0-9]){10,15}[^0-9]*$)\+?(?:[0-9]+[ -]?)?(?:\([0-9]+\)[ -]?)?[0-9]+(?:[ -][0-9]+)*',
        'message' => 'Введите от 10 до 15 цифр, например +7 (999) 123-45-67.',
    ],
];

function checkContact(string $key, string $value): void {
    $rule = CONTACT_RULES[$key];
    if (!preg_match('#\A(?:'.str_replace('#','\#',$rule['pattern']).')\z#u', $value)) {
        fail($rule['message'], $key);
    }
}
