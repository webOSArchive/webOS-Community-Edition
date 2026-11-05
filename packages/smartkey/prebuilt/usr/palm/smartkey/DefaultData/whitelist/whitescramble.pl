#!/usr/bin/perl -w

# Scramble (ever so slightly) a list of whitelist words

use strict;


##
# So secure nobody will ever figure this one out ;-)
#
sub scramble
{
	my $string = shift;
	my $newstr = '';

	while (/(.)/g) { # . is never a newline here
		$newstr = $newstr . chr(ord($1) + 1);
    }

	return $newstr;
}

my @words;

open FILE, $ARGV[0] or die "Can't open input file: $!";

while (<FILE>) {
	chomp;
	push @words, scramble($_);
}

close FILE;

open FILE, '>', $ARGV[0] or die "Can't open output file: $!";
foreach (@words) {
	print FILE $_ . "\n"
}
